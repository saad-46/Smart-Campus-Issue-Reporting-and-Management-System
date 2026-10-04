// ============================================
// Repair tips for workers (keyword-based)
// ============================================

import { Issue } from "@/types";

/** Keyword rules, matched as whole words (or word starts) in the description and category. */
const RULES: { pattern: RegExp; tip: (location: string) => string }[] = [
  {
    pattern: /\b(water|leak\w*|plumb\w*|tap|pipe\w*)\b/,
    tip: (l) => `Check pipeline valve near ${l} for leakage. Often caused by deteriorating seals. Bring a wrench set and spare O-rings.`,
  },
  {
    pattern: /\b(lights?|electri\w*|power|socket|switch(es)?|fan)\b/,
    tip: (l) => `Inspect breaker panel serving ${l}. If breaker trips instantly, check for a short in the local circuitry. Ensure to lock out tag out before starting work.`,
  },
  {
    pattern: /\b(doors?|windows?|locks?|hinges?)\b/,
    tip: (l) => `Verify the alignment of hinges and strike plates at ${l}. Apply WD-40 or graphite powder to mechanisms.`,
  },
  {
    pattern: /\b(wi-?fi|network|internet|router)\b/,
    tip: (l) => `Reboot the local AP near ${l}. Check Ethernet uplink status lights. If persist, verify switch port configuration.`,
  },
];

/**
 * Returns a generic repair tip chosen by keywords in the description and
 * category (not the location, so "Block A" doesn't read as "lock").
 * Rule-based (no language model) and labelled as such in the UI.
 */
export async function getSuggestedSolution(issue: Pick<Issue, 'description' | 'category' | 'location'>): Promise<string> {
  const text = `${issue.description} ${issue.category}`.toLowerCase();
  const rule = RULES.find((r) => r.pattern.test(text));
  return rule
    ? rule.tip(issue.location)
    : `Perform a standard diagnostic check at ${issue.location}. Review manufacturer manuals for related ${issue.category} equipment.`;
}
