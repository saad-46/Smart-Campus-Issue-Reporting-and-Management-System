// ============================================
// AI Assist Service for Workers
// ============================================

import { Issue } from "@/types";

/**
 * Returns a mock AI-generated suggestion based on the issue description, category, and location.
 * In a real application, this would call OpenAI or Claude APIs.
 */
export async function getSuggestedSolution(issue: Pick<Issue, 'description' | 'category' | 'location'>): Promise<string> {
  // Simulate network delay for realism (300ms)
  await new Promise(resolve => setTimeout(resolve, 300));

  const text = `${issue.description} ${issue.category} ${issue.location}`.toLowerCase();

  // Basic keyword heuristics for mockup
  if (text.includes("water") || text.includes("leak") || text.includes("plumb")) {
    return `Check pipeline valve near ${issue.location} for leakage. Often caused by deteriorating seals. Bring a wrench set and spare O-rings.`;
  }
  if (text.includes("light") || text.includes("electri") || text.includes("power")) {
    return `Inspect breaker panel serving ${issue.location}. If breaker trips instantly, check for a short in the local circuitry. Ensure to lock out tag out before starting work.`;
  }
  if (text.includes("door") || text.includes("window") || text.includes("lock")) {
    return `Verify the alignment of hinges and strike plates at ${issue.location}. Apply WD-40 or graphite powder to mechanisms.`;
  }
  if (text.includes("wifi") || text.includes("network") || text.includes("internet")) {
    return `Reboot the local AP near ${issue.location}. Check Ethernet uplink status lights. If persist, verify switch port configuration.`;
  }
  
  return `Perform a standard diagnostic check at ${issue.location}. Review manufacturer manuals for related ${issue.category} equipment.`;
}
