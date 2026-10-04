import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";
import { formatRelative, greeting } from "@/lib/dates";

describe("cn", () => {
  it("joins strings and drops falsy values", () => {
    expect(cn("a", false, null, undefined, 0, "", "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});

describe("formatRelative", () => {
  const now = new Date(2026, 9, 3, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const M = 60_000;
  const H = 60 * M;

  it("describes recent times in words", () => {
    expect(formatRelative(ago(10_000), now)).toBe("just now");
    expect(formatRelative(ago(M), now)).toBe("1 minute ago");
    expect(formatRelative(ago(5 * M), now)).toBe("5 minutes ago");
    expect(formatRelative(ago(3 * H), now)).toBe("3 hours ago");
  });

  it("uses Yesterday, then days, then a date", () => {
    expect(formatRelative(new Date(2026, 9, 2, 9, 0), now)).toBe("Yesterday");
    expect(formatRelative(new Date(2026, 8, 30, 9, 0), now)).toBe("3 days ago");
    expect(formatRelative(new Date(2026, 8, 1, 9, 0), now)).toBe("Sep 1");
    expect(formatRelative(new Date(2025, 8, 1, 9, 0), now)).toBe("Sep 1, 2025");
  });

  it("handles missing values", () => {
    expect(formatRelative(undefined, now)).toBe("—");
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe("Good morning");
    expect(greeting(new Date(2026, 0, 1, 14))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 0, 1, 20))).toBe("Good evening");
  });
});
