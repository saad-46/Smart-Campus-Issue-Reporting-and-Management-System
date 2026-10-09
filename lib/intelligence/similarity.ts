// ============================================
// Duplicate detection & incident clustering
// ============================================
// Transparent text + location similarity (no model). Scores are used to
// *suggest* duplicates; nothing is ever merged or deleted automatically.

import { IssueSummary } from "@/types";
import { matchBuilding } from "@/lib/campus";

/** Phrases that mean the same thing, folded to one token before comparing. */
const SYNONYMS: [RegExp, string][] = [
  [/\b(air[\s-]?condition(er|ing)?|a\/c|hvac|aircon)\b/g, " ac "],
  [/\b(not cooling|no cooling|cooling)\b/g, " ac "],
  [/\b(wi[\s-]?fi|internet|network|lan|router)\b/g, " network "],
  [/\b(rest[\s-]?room|wash[\s-]?room|toilet|lavatory|bathroom|loo)\b/g, " restroom "],
  [/\b(tube[\s-]?light|lights?|bulbs?|lamps?)\b/g, " light "],
  [/\b(faucet|taps?)\b/g, " tap "],
  [/\b(leak(s|ing|age|ed)?)\b/g, " leak "],
  [/\b(not working|stopped working|out of order|broken|failure|failed|dead|stopped|malfunction(ing)?|faulty)\b/g, " broken "],
  [/\b(power[\s-]?(cut|outage|failure)|no power|electricity)\b/g, " power "],
  [/\b(laboratory|labs)\b/g, " lab "],
];

const STOPWORDS = new Set([
  "the", "a", "an", "in", "on", "at", "of", "to", "and", "or", "is", "are", "was", "were", "it",
  "this", "that", "there", "near", "for", "with", "from", "by", "be", "been", "has", "have", "not",
  "no", "very", "please", "fix", "issue", "problem", "room", "floor", "block", "since", "again",
]);

function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Normalised word set for comparing two reports. */
export function tokenize(text: string): Set<string> {
  let normalized = ` ${text.toLowerCase()} `;
  for (const [pattern, token] of SYNONYMS) normalized = normalized.replace(pattern, token);
  const tokens = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
  return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Room-like numbers in a location ("Lab 204", "Room 12B" → "204", "12b"). */
function roomNumbers(location: string): Set<string> {
  return new Set((location.toLowerCase().replace(/\bblocks?\s*\d+\b/g, " ").match(/\b\d{1,4}[a-z]?\b/g) ?? []).map((n) => n));
}

/**
 * 1 for the same place (same QR location, or same building and room
 * number), 0.5 for the same building, 0 otherwise.
 */
export function locationSimilarity(
  a: Pick<IssueSummary, "location" | "locationId">,
  b: Pick<IssueSummary, "location" | "locationId">
): number {
  if (a.locationId && a.locationId === b.locationId) return 1;
  const roomsA = roomNumbers(a.location);
  const roomsB = roomNumbers(b.location);
  const sameRoom = [...roomsA].some((r) => roomsB.has(r));
  const buildingA = matchBuilding(a.location)?.id;
  const buildingB = matchBuilding(b.location)?.id;
  if (buildingA && buildingA === buildingB) return sameRoom ? 1 : 0.5;
  if (!buildingA && !buildingB) {
    // Neither location is a known building: fall back to wording.
    if (sameRoom) return 0.75;
    return jaccard(tokenize(a.location), tokenize(b.location)) >= 0.5 ? 0.5 : 0;
  }
  return 0;
}

type Comparable = Pick<IssueSummary, "title" | "category" | "location" | "locationId">;

/** Weighted similarity 0–1: wording 55%, place 35%, category 10%. */
export function issueSimilarity(a: Comparable, b: Comparable): number {
  const text = jaccard(tokenize(a.title), tokenize(b.title));
  const place = locationSimilarity(a, b);
  const category = a.category === b.category ? 1 : 0;
  return Math.round((0.55 * text + 0.35 * place + 0.1 * category) * 100) / 100;
}

export const DUPLICATE_THRESHOLD = 0.55;
/** Only reports this recent are considered when looking for duplicates. */
export const DUPLICATE_WINDOW_DAYS = 14;

export interface DuplicateMatch {
  issue: IssueSummary;
  score: number;
}

/**
 * Open / in-progress issues from the last DUPLICATE_WINDOW_DAYS that look
 * like the same problem, best match first.
 */
export function findDuplicates(
  candidate: Comparable,
  pool: IssueSummary[],
  now: Date = new Date(),
  { threshold = DUPLICATE_THRESHOLD, max = 3 } = {}
): DuplicateMatch[] {
  const since = now.getTime() - DUPLICATE_WINDOW_DAYS * 86_400_000;
  return pool
    .filter((issue) => issue.status !== "Resolved" && issue.createdAt.getTime() >= since)
    .map((issue) => ({ issue, score: issueSimilarity(candidate, issue) }))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score || b.issue.createdAt.getTime() - a.issue.createdAt.getTime())
    .slice(0, max);
}

export interface IncidentCluster {
  /** The first report — the one the others point to with duplicateOf. */
  masterIssueId: string;
  relatedIssueIds: string[];
  reportCount: number;
  title: string;
  category: string;
  location: string;
  status: IssueSummary["status"];
  firstReportedAt: Date;
  lastReportedAt: Date;
}

function summarize(master: IssueSummary, members: IssueSummary[]): IncidentCluster {
  const all = [master, ...members];
  const times = all.map((i) => i.createdAt.getTime());
  return {
    masterIssueId: master.id,
    relatedIssueIds: members.map((m) => m.id),
    reportCount: all.length,
    title: master.title,
    category: master.category,
    location: master.location,
    status: master.status,
    firstReportedAt: new Date(Math.min(...times)),
    lastReportedAt: new Date(Math.max(...times)),
  };
}

/**
 * Incidents admins have confirmed: reports linked with duplicateOf,
 * grouped under their master issue (largest first). A master that isn't
 * in `issues` (e.g. outside the loaded window) is skipped.
 */
export function confirmedClusters(issues: IssueSummary[]): IncidentCluster[] {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const groups = new Map<string, IssueSummary[]>();
  for (const issue of issues) {
    if (!issue.duplicateOf || issue.duplicateOf === issue.id) continue;
    const list = groups.get(issue.duplicateOf) ?? [];
    list.push(issue);
    groups.set(issue.duplicateOf, list);
  }
  return [...groups.entries()]
    .flatMap(([masterId, members]) => {
      const master = byId.get(masterId);
      return master ? [summarize(master, members)] : [];
    })
    .sort((a, b) => b.reportCount - a.reportCount || b.lastReportedAt.getTime() - a.lastReportedAt.getTime());
}

/**
 * Groups of unlinked, unresolved reports that look like one incident —
 * shown to admins as suggestions to confirm. Greedy single-link grouping
 * around the earliest report; O(n²) over a bounded window.
 */
export function suggestClusters(issues: IssueSummary[], threshold = DUPLICATE_THRESHOLD): IncidentCluster[] {
  const open = issues
    .filter((i) => i.status !== "Resolved" && !i.duplicateOf)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const linkedMasters = new Set(issues.filter((i) => i.duplicateOf).map((i) => i.duplicateOf));
  const used = new Set<string>();
  const clusters: IncidentCluster[] = [];

  for (const master of open) {
    if (used.has(master.id) || linkedMasters.has(master.id)) continue;
    // A confirmed incident's main report is never suggested as a member
    // (linking it would chain one incident under another).
    const members = open.filter(
      (other) =>
        other.id !== master.id && !used.has(other.id) && !linkedMasters.has(other.id) &&
        issueSimilarity(master, other) >= threshold
    );
    if (members.length === 0) continue;
    used.add(master.id);
    members.forEach((m) => used.add(m.id));
    clusters.push(summarize(master, members));
  }
  return clusters.sort((a, b) => b.reportCount - a.reportCount);
}
