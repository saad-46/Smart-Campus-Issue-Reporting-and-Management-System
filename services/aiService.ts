// ============================================
// AI Issue Analysis Service (keyword-based)
// ============================================
// Despite the name, there is no machine-learning model or external API
// here: issues are categorised by deterministic keyword matching, entirely
// in the browser. The output is a *suggestion* — createIssue() and
// firestore.rules both re-validate the category and priority.
//
// FUTURE: Replace classifyIssue() with a call to a real model behind a
// server-side API route (never call a model API with a key from the browser).

import { AIAnalysisResult, Priority } from "@/types";
import { DEFAULT_CATEGORY, DEFAULT_PRIORITY, LIMITS, departmentFor } from "@/lib/constants";
import { cleanText } from "@/lib/validation";
import { findCanonicalLocation, matchBuilding } from "@/lib/campus";

/**
 * Keyword-to-category mapping.
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

const HIGH_PRIORITY_KEYWORDS = [
  "urgent", "emergency", "dangerous", "hazard", "fire", "flood",
  "broken glass", "exposed wire", "injury", "accident", "immediately",
  "critical", "severe", "life-threatening",
];

const MEDIUM_PRIORITY_KEYWORDS = [
  "broken", "not working", "malfunction", "issue", "problem",
  "damaged", "leaking", "stuck", "faulty", "flickering",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word keyword match. Plain substring matching misfires badly on
 * short keywords ("ac" in "back", "rat" in "separate", "lab" in
 * "available"), so short keywords must match a whole word (optionally
 * plural) and longer ones must start a word ("leak" matches "leaking").
 */
function buildMatcher(keyword: string): RegExp {
  const escaped = escapeRegExp(keyword);
  return keyword.length <= 3
    ? new RegExp(`\\b${escaped}s?\\b`)
    : new RegExp(`\\b${escaped}`);
}

function compile(keywords: string[]): RegExp[] {
  return keywords.map(buildMatcher);
}

const CATEGORY_MATCHERS: [string, RegExp[]][] = Object.entries(CATEGORY_KEYWORDS).map(
  ([category, keywords]) => [category, compile(keywords)]
);
const HIGH_PRIORITY_MATCHERS = compile(HIGH_PRIORITY_KEYWORDS);
const MEDIUM_PRIORITY_MATCHERS = compile(MEDIUM_PRIORITY_KEYWORDS);

interface Scored {
  category: string;
  priority: Priority;
  /** Keywords that decided the category, in list order. */
  categoryKeywords: string[];
  /** Keyword hits across all categories (for the confidence heuristic). */
  totalHits: number;
  priorityKeyword: string | null;
}

function score(text: unknown): Scored {
  const normalized = cleanText(text, true).slice(0, LIMITS.description).toLowerCase();
  const empty: Scored = {
    category: DEFAULT_CATEGORY,
    priority: DEFAULT_PRIORITY,
    categoryKeywords: [],
    totalHits: 0,
    priorityKeyword: null,
  };
  if (!normalized) return empty;

  // --- Determine Category --- (the category with the most keyword hits
  // wins; ties go to whichever is listed first)
  let best = empty;
  let totalHits = 0;
  for (const [candidate, matchers] of CATEGORY_MATCHERS) {
    const hits = CATEGORY_KEYWORDS[candidate].filter((_, i) => matchers[i].test(normalized));
    totalHits += hits.length;
    if (hits.length > best.categoryKeywords.length) {
      best = { ...best, category: candidate, categoryKeywords: hits };
    }
  }

  // --- Determine Priority ---
  let priority: Priority = DEFAULT_PRIORITY;
  let priorityKeyword: string | null = null;
  const high = HIGH_PRIORITY_MATCHERS.findIndex((m) => m.test(normalized));
  const medium = MEDIUM_PRIORITY_MATCHERS.findIndex((m) => m.test(normalized));
  if (high >= 0) {
    priority = "High";
    priorityKeyword = HIGH_PRIORITY_KEYWORDS[high];
  } else if (medium >= 0) {
    priority = "Medium";
    priorityKeyword = MEDIUM_PRIORITY_KEYWORDS[medium];
  }

  return { ...best, priority, totalHits, priorityKeyword };
}

/**
 * Synchronous, deterministic classifier. Never throws: anything it can't
 * make sense of comes back as General / Low.
 */
export function classifyIssue(text: unknown): AIAnalysisResult {
  const { category, priority } = score(text);
  return { category, priority };
}

export interface IssueIntelligence extends AIAnalysisResult {
  /**
   * 0–1. A heuristic derived from how many keywords matched and how
   * clearly one category won — not a calibrated probability.
   */
  confidence: number;
  /** One-sentence reason, built from the keywords that actually matched. */
  explanation: string;
  /** Extractive summary for long reports (a sentence from the report); "" when not needed. */
  summary: string;
  /** Team that usually handles this category. */
  department: string;
}

/**
 * Heuristic confidence: rises with the number of supporting keywords and
 * falls when other categories also matched. Clamped to 0.3–0.95 so it is
 * never presented as certainty.
 */
export function heuristicConfidence(winningHits: number, totalHits: number): number {
  if (winningHits <= 0 || totalHits <= 0) return 0.3;
  const dominance = winningHits / totalHits;
  const support = 1 - Math.pow(0.5, winningHits);
  return Math.round(Math.min(0.95, Math.max(0.3, dominance * support + 0.05)) * 100) / 100;
}

/** Reports shorter than this don't need a summary. */
const SUMMARY_MIN_LENGTH = 160;
const SUMMARY_MAX_LENGTH = 160;

function trimToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/**
 * Extractive summary: the most informative sentence of a long report
 * (the first one mentioning a matched keyword, else the first sentence).
 * The original description is always kept; this is only an aid.
 */
export function summarizeReport(description: unknown, keywords: string[] = []): string {
  const text = cleanText(description, true);
  if (text.length < SUMMARY_MIN_LENGTH) return "";

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);
  if (sentences.length === 0) return trimToWord(text, SUMMARY_MAX_LENGTH);

  const matchers = keywords.map(buildMatcher);
  const informative =
    sentences.find((sentence) => matchers.some((m) => m.test(sentence.toLowerCase()))) ?? sentences[0];
  return trimToWord(informative, SUMMARY_MAX_LENGTH);
}

function quoteList(words: string[]): string {
  const quoted = words.slice(0, 3).map((word) => `"${word}"`);
  return quoted.length <= 1 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}

/**
 * Full analysis of a report: category, priority, heuristic confidence,
 * a short explanation, an extractive summary and the suggested team.
 * Deterministic and offline — there is no language model behind it.
 */
export function analyzeIssueDetails(input: {
  title?: unknown;
  description?: unknown;
  location?: unknown;
}): IssueIntelligence {
  const title = cleanText(input.title);
  const description = cleanText(input.description, true);
  const location = cleanText(input.location);
  const scored = score(`${title}. ${description}`);

  const where = location && location.toLowerCase() !== "unknown" ? ` at ${location}` : "";
  let explanation = scored.categoryKeywords.length
    ? `Classified as ${scored.category} because the report mentions ${quoteList(scored.categoryKeywords)}${where}.`
    : `No category keywords matched, so it was filed as ${DEFAULT_CATEGORY}.`;
  if (scored.priorityKeyword) {
    explanation += ` Priority ${scored.priority} because of "${scored.priorityKeyword}".`;
  }

  return {
    category: scored.category,
    priority: scored.priority,
    confidence: heuristicConfidence(scored.categoryKeywords.length, scored.totalHits),
    explanation,
    summary: summarizeReport(description, scored.categoryKeywords),
    department: departmentFor(scored.category),
  };
}

/**
 * Analyze an issue description and return a category + priority.
 *
 * @example
 * const result = await analyzeIssue("The light in Room 201 is flickering and making buzzing sounds");
 * // Returns: { category: "Electrical", priority: "Medium" }
 */
export async function analyzeIssue(description: string): Promise<AIAnalysisResult> {
  // Short pause so the "analysing" state is visible in the UI.
  await new Promise((resolve) => setTimeout(resolve, 800));
  return classifyIssue(description);
}

/**
 * Best-effort location from free text: a room/lab/hall number or a block
 * or number ("room 12", "Block 4"), combined with a known SUES campus location
 * when one is mentioned ("library reading room" → "S.M. Nizamuddin Central Library").
 * Words that merely follow "room" ("room since …") are not taken as ids.
 */
export function extractLocation(text: string): string {
  const id = text.match(/\b(block\s+(?:[a-z]|\d{1,3})|(?:room|lab|hall)\s+[a-z]?\d{1,4}[a-z]?)\b/i)?.[0];
  if (id && /^block/i.test(id)) return id;
  const known = findCanonicalLocation(text);
  if (known) return id ? `${known.name}, ${id}` : known.name;
  return id ?? matchBuilding(text)?.name ?? "Unknown";
}

/**
 * Parse a free‑form chat message into a full issue payload.
 * Simple heuristic: first sentence → title, the whole message → description.
 * Extract location by looking for patterns like "block A" or "room 101".
 */
export async function parseChatMessage(message: string): Promise<IssueIntelligence & {
  title: string;
  description: string;
  location: string;
}> {
  const text = cleanText(message, true).slice(0, LIMITS.description);

  const [first] = text.split(/[.!?\n]\s*/);
  const title = (first?.trim() || "Untitled Issue").slice(0, LIMITS.title);

  const location = extractLocation(text);

  // Short pause so the chat's typing indicator is visible.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const analysis = analyzeIssueDetails({ title, description: text, location });

  return {
    ...analysis,
    title,
    // Keep the reporter's full message: a one-sentence report would
    // otherwise be saved with an empty description.
    description: text,
    location,
  };
}
