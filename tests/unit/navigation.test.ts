import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/navigation";

describe("safeRedirectPath (post-login redirect)", () => {
  it("accepts same-site paths with a query", () => {
    expect(safeRedirectPath("/dashboard/report?location=lab-204")).toBe("/dashboard/report?location=lab-204");
    expect(safeRedirectPath("/issues/abc123")).toBe("/issues/abc123");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.example/",
      "//evil.example/path",
      "/\\evil.example",
      "javascript:alert(1)",
      "dashboard",
      "/%0d%0aSet-Cookie:x",
      "/ok\u0000",
      "",
      null,
      undefined,
    ]) {
      const result = safeRedirectPath(bad);
      if (result !== null) expect(result.startsWith("/") && !result.startsWith("//")).toBe(true);
      if (typeof bad === "string" && /^(https?:|\/\/|\/\\|javascript:)/.test(bad)) expect(result).toBeNull();
    }
    expect(safeRedirectPath("https://evil.example/")).toBeNull();
    expect(safeRedirectPath("//evil.example/path")).toBeNull();
    expect(safeRedirectPath("/\\evil.example")).toBeNull();
    expect(safeRedirectPath("dashboard")).toBeNull();
  });

  it("does not loop back to the login or register pages", () => {
    expect(safeRedirectPath("/login?next=/admin")).toBeNull();
    expect(safeRedirectPath("/register")).toBeNull();
  });

  it("rejects overly long values", () => {
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBeNull();
  });
});
