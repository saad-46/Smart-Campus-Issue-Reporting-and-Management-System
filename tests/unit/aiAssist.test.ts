import { describe, expect, it } from "vitest";
import { getSuggestedSolution } from "@/services/aiAssistService";

describe("worker repair tips (keyword-based)", () => {
  it("matches whole words, not substrings or the location", async () => {
    const tip = await getSuggestedSolution({ description: "Lost and found request", category: "General", location: "Block A, Room 101" });
    expect(tip).toMatch(/standard diagnostic check/);
  });

  it("picks the matching rule", async () => {
    expect(await getSuggestedSolution({ description: "Tap leaking", category: "Plumbing", location: "Hostel" })).toMatch(/pipeline valve/);
    expect(await getSuggestedSolution({ description: "Door lock broken", category: "Infrastructure", location: "Lab" })).toMatch(/hinges/);
    expect(await getSuggestedSolution({ description: "WiFi down", category: "IT", location: "Library" })).toMatch(/Reboot the local AP/);
  });
});
