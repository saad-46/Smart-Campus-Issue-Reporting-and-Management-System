import { describe, expect, it } from "vitest";
import { payoutLabel, payoutNote } from "@/lib/claims";
import { normalizeIssue } from "@/lib/models";
import { validateClaimDescription } from "@/lib/validation";

describe("validateClaimDescription", () => {
  it("is optional and cleans whitespace and control characters", () => {
    expect(validateClaimDescription("")).toBe("");
    expect(validateClaimDescription(undefined)).toBe("");
    expect(validateClaimDescription("  Replacement\n tap\tcartridge \u0007 ")).toBe("Replacement tap cartridge");
  });

  it("rejects text over 500 characters", () => {
    expect(validateClaimDescription("x".repeat(500))).toHaveLength(500);
    expect(() => validateClaimDescription("x".repeat(501))).toThrow(/500 characters/);
  });
});

describe("payout ledger wording", () => {
  it("records the issue and what the money was spent on", () => {
    expect(payoutNote("Leaking tap", "Replacement cartridge")).toBe("Leaking tap — Replacement cartridge");
    expect(payoutNote("Leaking tap", "")).toBe("Leaking tap");
    expect(payoutNote("Leaking tap")).toBe("Leaking tap");
    expect(payoutNote("x".repeat(600), "y")).toHaveLength(500);
  });

  it("shows entries written before descriptions were stored without the old prefix", () => {
    expect(payoutLabel("Receipt resolved for Network very slow")).toBe("Network very slow");
    expect(payoutLabel("Leaking tap — Replacement cartridge")).toBe("Leaking tap — Replacement cartridge");
    expect(payoutLabel("")).toBe("Payout");
    expect(payoutLabel(undefined, "Task payout")).toBe("Task payout");
  });
});

describe("claims in issue documents", () => {
  it("keeps the description of a new claim", () => {
    const issue = normalizeIssue("a", { claimAmount: 450, claimStatus: "pending", claimDescription: "Parts" });
    expect(issue.claimDescription).toBe("Parts");
  });

  it("renders older claims without a description safely", () => {
    const issue = normalizeIssue("b", { claimAmount: 450, claimStatus: "approved" });
    expect(issue.claimDescription).toBe("");
    expect(issue.claimAmount).toBe(450);
    expect(normalizeIssue("c", { claimDescription: 42 }).claimDescription).toBe("");
  });
});
