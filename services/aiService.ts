// ============================================
// AI Issue Analysis Service (Placeholder)
// ============================================
// This module provides a mock AI analysis function
// that categorizes issues and assigns priority levels.
//
// FUTURE: Replace the mock logic with a real API call
// to OpenAI, Claude, or another AI service.

import { AIAnalysisResult, Priority } from "@/types";

/**
 * Keyword-to-category mapping for smart mock analysis.
 * This makes demos look realistic by analyzing actual description content.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Electrical: [
    "light", "bulb", "wire", "socket", "power", "electricity",
    "switch", "fuse", "outlet", "voltage", "electrical", "lamp",
    "fan", "ac", "air conditioner", "heater",
  ],
  Plumbing: [
    "water", "leak", "pipe", "drain", "tap", "faucet", "toilet",
    "sink", "flood", "sewage", "plumbing", "clog", "bathroom",
  ],
  Infrastructure: [
    "road", "path", "building", "wall", "crack", "ceiling", "floor",
    "door", "window", "roof", "stair", "elevator", "lift", "parking",
    "gate", "fence", "bench", "broken",
  ],
  Cleanliness: [
    "trash", "garbage", "dirty", "clean", "dust", "waste", "litter",
    "hygiene", "sanitation", "smell", "pest", "insect", "cockroach",
    "rat", "mosquito",
  ],
  Safety: [
    "fire", "alarm", "emergency", "hazard", "danger", "security",
    "cctv", "camera", "guard", "theft", "vandal", "accident",
    "unsafe", "extinguisher",
  ],
  IT: [
    "wifi", "internet", "network", "computer", "projector", "printer",
    "software", "server", "login", "password", "website", "system",
    "lab", "monitor", "screen",
  ],
  Furniture: [
    "chair", "desk", "table", "cupboard", "shelf", "board",
    "whiteboard", "podium", "locker",
  ],
  Landscaping: [
    "tree", "grass", "garden", "plant", "branch", "lawn", "mud",
    "landscape", "irrigation", "sprinkler",
  ],
};

/**
 * Determine priority based on urgency keywords in the description.
 */
const HIGH_PRIORITY_KEYWORDS = [
  "urgent", "emergency", "dangerous", "hazard", "fire", "flood",
  "broken glass", "exposed wire", "injury", "accident", "immediately",
  "critical", "severe", "life-threatening",
];

const MEDIUM_PRIORITY_KEYWORDS = [
  "broken", "not working", "malfunction", "issue", "problem",
  "damaged", "leaking", "stuck", "faulty", "flickering",
];

/**
 * Analyze an issue description and return a category + priority.
 *
 * @param description - The issue description text from the user
 * @returns Promise<AIAnalysisResult> - The AI analysis with category and priority
 *
 * @example
 * const result = await analyzeIssue("The light in Room 201 is flickering and making buzzing sounds");
 * // Returns: { category: "Electrical", priority: "Medium" }
 */
export async function analyzeIssue(
  description: string
): Promise<AIAnalysisResult> {
  // Simulate network delay (like a real AI API call)
  await new Promise((resolve) => setTimeout(resolve, 800));

  const lowerDesc = description.toLowerCase();

  // --- Determine Category ---
  let detectedCategory = "General";
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter((kw) => lowerDesc.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedCategory = category;
    }
  }

  // --- Determine Priority ---
  let detectedPriority: Priority = "Low";

  if (HIGH_PRIORITY_KEYWORDS.some((kw) => lowerDesc.includes(kw))) {
    detectedPriority = "High";
  } else if (MEDIUM_PRIORITY_KEYWORDS.some((kw) => lowerDesc.includes(kw))) {
    detectedPriority = "Medium";
  }

  return {
    category: detectedCategory,
    priority: detectedPriority,
  };
}

/**
 * Parse a free‑form chat message into a full issue payload.
 * Simple heuristic: first sentence → title, rest → description.
 * Extract location by looking for patterns like "block A" or "room 101".
 */
export async function parseChatMessage(message: string): Promise<{
  title: string;
  description: string;
  location: string;
  category: string;
  priority: Priority;
}> {
  // Basic split – first period as title delimiter
  const [first, ...rest] = message.split(/[.!?]\s+/);
  const title = first?.trim() || "Untitled Issue";
  const description = rest.length ? rest.join(" ").trim() : "";

  // Location extraction (very naive)
  const locationMatch = message.match(/(block\s+[a-zA-Z0-9]+|room\s+[a-zA-Z0-9]+)/i);
  const location = locationMatch ? locationMatch[0] : "Unknown";

  // Re‑use existing analysis for category & priority
  const analysis = await analyzeIssue(message);

  return {
    title,
    description,
    location,
    category: analysis.category,
    priority: analysis.priority,
  };
}
