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
  sanitizePinInput,
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
  const valid = { name: "Asha Rao", email: "asha@example.com", password: "482910", role: "user" as const };

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

  it("keeps the PIN exactly as typed, including leading zeros", () => {
    expect(validateRegistration({ ...valid, password: "000123" }).password).toBe("000123");
  });

  it("accepts a worker registration with a valid PIN", () => {
    const out = validateRegistration({ ...valid, role: "worker", password: "090909" });
    expect(out.role).toBe("worker");
    expect(out.password).toBe("090909");
  });

  it.each(["", "12345", "1234567", "12ab56", "abcdef", "12 456", "١٢٣٤٥٦", "campus2024"])("rejects the PIN %j", (password) => {
    expect(() => validateRegistration({ ...valid, password })).toThrow(ValidationError);
  });

  it("rejects an administrator registration even with a valid PIN", () => {
    expect(() => validateRegistration({ ...valid, role: "admin", password: "123456" })).toThrow(ValidationError);
  });

  it("reports the PIN problem with the same message the form shows", () => {
    expect(() => validateRegistration({ ...valid, password: "12ab56" })).toThrow(getPasswordError("12ab56") as string);
  });
});

describe("getPasswordError (the six-digit registration PIN)", () => {
  it.each(["123456", "000123", "000000", "999999"])("accepts %j", (pin) => {
    expect(getPasswordError(pin)).toBeNull();
  });

  it("asks for a PIN when it is empty", () => {
    expect(getPasswordError("")).toMatch(/Enter your 6-digit PIN/);
  });

  it.each(["1", "12345"])("rejects the too-short PIN %j", (pin) => {
    expect(getPasswordError(pin)).toMatch(/exactly 6 digits/);
  });

  it.each(["1234567", "12345678901234567890"])("rejects the too-long PIN %j", (pin) => {
    expect(getPasswordError(pin)).toMatch(/exactly 6 digits/);
  });

  it.each(["abcdef", "12ab56", "12-456", "12 456", "campus2024", "1234.5", "+12345", "123456\n"])("rejects the non-numeric PIN %j", (pin) => {
    expect(getPasswordError(pin)).toMatch(/only contain the digits/);
  });

  it("uses the same length as the form's input limit", () => {
    expect(LIMITS.pinLength).toBe(6);
  });
});

describe("sanitizePinInput (what the PIN field keeps)", () => {
  it("drops everything that is not a digit", () => {
    expect(sanitizePinInput("12ab-34 56")).toBe("123456");
  });

  it("limits the PIN to six digits, from typing or pasting", () => {
    expect(sanitizePinInput("123456789")).toBe("123456");
  });

  it("keeps leading zeros", () => {
    expect(sanitizePinInput("000123")).toBe("000123");
    expect(typeof sanitizePinInput("000123")).toBe("string");
  });

  it("handles empty and missing input", () => {
    expect(sanitizePinInput("")).toBe("");
    expect(sanitizePinInput(undefined as unknown as string)).toBe("");
  });

  it("produces a value the policy accepts when six digits were entered", () => {
    expect(getPasswordError(sanitizePinInput("0 0 1 2 3 4"))).toBeNull();
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
