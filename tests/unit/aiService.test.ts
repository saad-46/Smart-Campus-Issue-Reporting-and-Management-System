import { describe, expect, it } from "vitest";
import { ISSUE_CATEGORIES, LIMITS, PRIORITIES } from "@/lib/constants";
import { analyzeIssue, classifyIssue, extractLocation, parseChatMessage } from "@/services/aiService";

describe("classifyIssue — category", () => {
  it.each([
    ["The light in Room 201 is flickering", "Electrical"],
    ["Water is leaking from the pipe in the bathroom", "Plumbing"],
    ["There is a crack in the wall near the stairs", "Infrastructure"],
    ["Garbage and litter piling up, very dirty", "Cleanliness"],
    ["The fire alarm and extinguisher are missing", "Safety"],
    ["Wifi and internet are down in the computer lab", "IT"],
    ["The chair and desk in the classroom are wobbly", "Furniture"],
    ["Tree branch fell on the lawn near the garden", "Landscaping"],
  ])("categorises %j as %s", (text, expected) => {
    expect(classifyIssue(text).category).toBe(expected);
  });

  it("falls back to General when nothing matches", () => {
    expect(classifyIssue("Something odd happened yesterday").category).toBe("General");
  });

  it("does not match short keywords inside other words", () => {
    // "ac" in "back"/"place", "rat" in "separate", "lab" in "available", "tap" in "staple"
    expect(classifyIssue("Please take it back to a separate place when available").category).toBe("General");
    expect(classifyIssue("Need a staple remover").category).toBe("General");
  });

  it("still matches short keywords as whole words, including plurals", () => {
    expect(classifyIssue("The AC is not cooling").category).toBe("Electrical");
    expect(classifyIssue("Saw two rats near the canteen").category).toBe("Cleanliness");
  });

  it("matches word stems (leak → leaking)", () => {
    expect(classifyIssue("The ceiling tap is leaking badly").category).toBe("Plumbing");
  });

  it("is case-insensitive", () => {
    expect(classifyIssue("WIFI NETWORK DOWN").category).toBe("IT");
  });
});

describe("classifyIssue — priority", () => {
  it("flags urgent language as High", () => {
    expect(classifyIssue("Exposed wire sparking, this is dangerous").priority).toBe("High");
    expect(classifyIssue("Urgent: flood in basement").priority).toBe("High");
  });

  it("flags breakage as Medium", () => {
    expect(classifyIssue("The projector is not working").priority).toBe("Medium");
  });

  it("defaults to Low", () => {
    expect(classifyIssue("Please repaint the bench").priority).toBe("Low");
  });

  it("prefers High when both High and Medium keywords appear", () => {
    expect(classifyIssue("Broken glass everywhere, urgent").priority).toBe("High");
  });
});

describe("classifyIssue — robustness", () => {
  it.each([[""], ["   "], [undefined], [null], [42], [{}]])("never throws on %j", (input) => {
    expect(classifyIssue(input)).toEqual({ category: "General", priority: "Low" });
  });

  it("always returns a value from the allowed enums", () => {
    const inputs = ["<script>alert(1)</script>", "🔥🔥🔥", "a".repeat(50_000), "fire water wifi chair tree"];
    for (const input of inputs) {
      const result = classifyIssue(input);
      expect(ISSUE_CATEGORIES).toContain(result.category);
      expect(PRIORITIES).toContain(result.priority);
    }
  });

  it("is deterministic", () => {
    const text = "Broken socket and leaking pipe near the lab";
    expect(classifyIssue(text)).toEqual(classifyIssue(text));
  });
});

describe("analyzeIssue", () => {
  it("resolves to the same result as the synchronous classifier", async () => {
    const text = "The light in Room 201 is flickering and making buzzing sounds";
    await expect(analyzeIssue(text)).resolves.toEqual({ category: "Electrical", priority: "Medium" });
  });
});

describe("parseChatMessage", () => {
  it("uses the first sentence as the title and keeps the whole message as the description", async () => {
    const result = await parseChatMessage("Water leak near Block A. It has been dripping since morning.");
    expect(result.title).toBe("Water leak near Block A");
    expect(result.description).toBe("Water leak near Block A. It has been dripping since morning.");
    expect(result.location).toBe("Block A");
    expect(result.category).toBe("Plumbing");
  });

  it("never produces an empty description for a one-sentence report", async () => {
    const result = await parseChatMessage("The fan in room 12 is broken");
    expect(result.description).toBe("The fan in room 12 is broken");
    expect(result.location.toLowerCase()).toBe("room 12");
  });

  it("falls back to an Unknown location", async () => {
    expect((await parseChatMessage("The fan is broken")).location).toBe("Unknown");
  });

  it("doesn't take the word after 'room' as a room id, and recognises buildings", async () => {
    expect((await parseChatMessage("The WiFi is not working in the library reading room since morning")).location).toBe("S.M. Nizamuddin Central Library");
    expect(extractLocation("projector broken in lab 204")).toBe("lab 204");
    expect(extractLocation("mic not working in the auditorium")).toBe("Ghulam Ahmed Hall");
    expect(extractLocation("net is torn at the badminton court")).toBe("Shuttle court (Physical Education)");
    expect(extractLocation("leak near block the stairs")).toBe("Unknown");
    expect(extractLocation("Block B toilet")).toBe("Block B");
    expect(extractLocation("Block 4 toilet")).toBe("Block 4");
  });

  it("caps the title length", async () => {
    const result = await parseChatMessage("word ".repeat(200));
    expect(result.title.length).toBeLessThanOrEqual(LIMITS.title);
  });
});
