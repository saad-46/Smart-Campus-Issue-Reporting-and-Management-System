import type { BadgeTone } from "@/components/ui/Badge";
import type { VerificationStatus } from "@/lib/campus";

/** Badge colour for how well a place's position is established. */
export const VERIFICATION_TONE: Record<VerificationStatus, BadgeTone> = {
  verified: "success",
  corroborated: "success",
  approximate: "info",
  conflicting: "warning",
  unverified: "neutral",
};
