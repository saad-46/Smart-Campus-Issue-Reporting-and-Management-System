import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/constants";
import { ValidationError } from "@/lib/errors";
import {
  cleanText,
  getPasswordError,
  isDisplayableImageUrl,
  isSafeImageDataUrl,
  isValidEmail,
  normalizeCategory,
  normalizePriority,
  parseAmount,
  validateChatMessage,
  validateImages,
  validateIssueInput,
  validateRegistration,
} from "@/lib/validation";

const TINY_PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("cleanText", () => {
  it("trims and collapses whitespace on single-line input", () => {
    expect(cleanText("  Broken \t light \n here  ")).toBe("Broken light here");
  });

  it("keeps newlines for multiline input but strips control characters", () => {
    expect(cleanText("line one\nline\u0000 two\u0007", true)).toBe("line one\nline two");
  });

  it("returns an empty string for non-strings", () => {
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(42)).toBe("");
    expect(cleanText({ toString: () => "x" })).toBe("");
  });
});

describe("validateIssueInput", () => {
  const valid = { title: "Broken light", description: "Flickers all day", location: "Block A" };

  it("accepts and normalises a valid issue", () => {
    expect(validateIssueInput({ ...valid, title: "  Broken   light " })).toEqual(valid);
  });

  it.each([
    ["empty title", { ...valid, title: "" }],
    ["whitespace-only title", { ...valid, title: "   \t " }],
    ["whitespace-only description", { ...valid, description: " \n\n " }],
    ["empty location", { ...valid, location: "" }],
    ["over-long title", { ...valid, title: "x".repeat(LIMITS.title + 1) }],
    ["over-long description", { ...valid, description: "x".repeat(LIMITS.description + 1) }],
    ["over-long location", { ...valid, location: "x".repeat(LIMITS.location + 1) }],
  ])("rejects %s", (_name, input) => {
    expect(() => validateIssueInput(input)).toThrow(ValidationError);
  });

  it("accepts values exactly at the limits", () => {
    const input = {
      title: "t".repeat(LIMITS.title),
      description: "d".repeat(LIMITS.description),
      location: "l".repeat(LIMITS.location),
    };
    expect(validateIssueInput(input)).toEqual(input);
  });

  it("stores markup as plain text rather than rejecting or altering it", () => {
    // React escapes on render; the data layer must not mangle the report.
    const xss = `<script>alert('XSS')</script><img src=x onerror=alert('XSS')>`;
    expect(validateIssueInput({ ...valid, description: xss }).description).toBe(xss);
  });

  it("preserves unicode", () => {
    expect(validateIssueInput({ ...valid, title: "పగిలిన లైట్ 💡" }).title).toBe("పగిలిన లైట్ 💡");
  });
});

describe("validateRegistration", () => {
  const valid = { name: "Asha Rao", email: "asha@example.com", password: "campus2024", role: "user" as const };

  it("accepts a valid registration and lower-cases the email", () => {
    expect(validateRegistration({ ...valid, email: " Asha@Example.COM " }).email).toBe("asha@example.com");
  });

  it("accepts a request for worker access (granted later by an admin, not by this form)", () => {
    expect(validateRegistration({ ...valid, role: "worker" }).role).toBe("worker");
  });

  it("never allows self-registration as admin", () => {
    expect(() => validateRegistration({ ...valid, role: "admin" })).toThrow(ValidationError);
  });

  it.each(["", "not-an-email", "a@b", "a b@c.com", "@example.com"])("rejects malformed email %j", (email) => {
    expect(() => validateRegistration({ ...valid, email })).toThrow(ValidationError);
  });

  it("rejects an empty or over-long name", () => {
    expect(() => validateRegistration({ ...valid, name: "   " })).toThrow(ValidationError);
    expect(() => validateRegistration({ ...valid, name: "n".repeat(LIMITS.name + 1) })).toThrow(ValidationError);
  });
});

describe("getPasswordError", () => {
  it("rejects short passwords", () => {
    expect(getPasswordError("abc12")).toMatch(/at least/);
  });

  it("requires both a letter and a number", () => {
    expect(getPasswordError("abcdefghij")).toMatch(/letter and one number/);
    expect(getPasswordError("1234567890")).toMatch(/letter and one number/);
  });

  it("accepts a reasonable password", () => {
    expect(getPasswordError("campus2024")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses and rejects absurdly long ones", () => {
    expect(isValidEmail("student@uni.edu")).toBe(true);
    expect(isValidEmail(`${"a".repeat(250)}@uni.edu`)).toBe(false);
  });
});

describe("AI output normalisation", () => {
  it("passes known categories and priorities through", () => {
    expect(normalizeCategory("Plumbing")).toBe("Plumbing");
    expect(normalizePriority("High")).toBe("High");
  });

  it("falls back to safe defaults for anything unexpected", () => {
    expect(normalizeCategory("<script>")).toBe("General");
    expect(normalizeCategory(undefined)).toBe("General");
    expect(normalizePriority("Critical")).toBe("Low");
    expect(normalizePriority(null)).toBe("Low");
  });
});

describe("image validation", () => {
  it("accepts inline base64 images", () => {
    expect(isSafeImageDataUrl(TINY_PNG)).toBe(true);
    expect(isDisplayableImageUrl(TINY_PNG)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "https://evil.example/tracker.png",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,abc\"><script>",
    "",
  ])("rejects %j", (url) => {
    expect(isSafeImageDataUrl(url)).toBe(false);
    expect(isDisplayableImageUrl(url)).toBe(false);
  });

  it("rejects an image over the size budget", () => {
    const big = `data:image/jpeg;base64,${"A".repeat(LIMITS.imageChars)}`;
    expect(isSafeImageDataUrl(big)).toBe(false);
  });

  it("still displays Firebase Storage URLs from older documents", () => {
    expect(isDisplayableImageUrl("https://firebasestorage.googleapis.com/v0/b/x/o/y.jpg")).toBe(true);
  });

  it("limits the number of attached images", () => {
    const image = { full: TINY_PNG, thumb: TINY_PNG };
    expect(validateImages([image, image, image])).toHaveLength(3);
    expect(() => validateImages([image, image, image, image])).toThrow(ValidationError);
  });

  it("rejects an attachment whose full image or thumbnail is unsafe or oversized", () => {
    expect(() => validateImages([{ full: "javascript:alert(1)", thumb: TINY_PNG }])).toThrow(ValidationError);
    expect(() => validateImages([{ full: TINY_PNG, thumb: "https://evil.example/x.png" }])).toThrow(ValidationError);
    const bigThumb = `data:image/jpeg;base64,${"A".repeat(LIMITS.thumbChars)}`;
    expect(() => validateImages([{ full: TINY_PNG, thumb: bigThumb }])).toThrow(ValidationError);
  });
});

describe("parseAmount", () => {
  it("parses valid amounts and rounds to 2 decimal places", () => {
    expect(parseAmount("250", 1000)).toBe(250);
    expect(parseAmount(" 99.999 ", 1000)).toBe(100);
    expect(parseAmount(12.345, 1000)).toBe(12.35);
  });

  it.each(["", "abc", "0", "-5", "NaN", "Infinity", "1e999"])("rejects %j", (value) => {
    expect(() => parseAmount(value, 1000)).toThrow(ValidationError);
  });

  it("rejects amounts above the maximum", () => {
    expect(() => parseAmount("1001", 1000)).toThrow(ValidationError);
    expect(parseAmount("1000", 1000)).toBe(1000);
  });
});

describe("validateChatMessage", () => {
  it("trims and accepts a normal message", () => {
    expect(validateChatMessage("  on my way  ")).toBe("on my way");
  });

  it("rejects empty and over-long messages", () => {
    expect(() => validateChatMessage("   ")).toThrow(ValidationError);
    expect(() => validateChatMessage("x".repeat(LIMITS.chatMessage + 1))).toThrow(ValidationError);
  });
});
