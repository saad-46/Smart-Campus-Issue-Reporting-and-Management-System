// College and branch choices for registration, and the ranking used by the
// searchable dropdowns. Data lives in data/ (see data/academics.json); nothing
// here is fetched at runtime, so registration never depends on a third party.

import academics from "@/data/academics.json";
import campus from "@/data/campuses/sues-hyderabad/institutions.json";

export interface ChoiceOption {
  /** What is stored. */
  value: string;
  /** What is shown and searched. */
  label: string;
  /** Short note shown beside the label. */
  hint?: string;
  /** Extra words that should find this option. */
  keywords?: string[];
}

/** The explicit "my choice isn't listed" entry. Picking it reveals a text field; nothing is accepted silently. */
export const OTHER_VALUE = "__other__";

export const COLLEGE_OPTIONS: ChoiceOption[] = campus.institutions.map((i) => ({
  value: i.name,
  label: i.name,
  hint: i.shortName && i.shortName !== i.name ? i.shortName : undefined,
  keywords: [i.shortName, i.id].filter((x): x is string => !!x),
}));

export function collegeId(collegeName: string): string | undefined {
  return campus.institutions.find((i) => i.name === collegeName)?.id;
}

type BranchTable = Record<string, { options: { label: string; hint?: string }[] }>;

/** Branches the data supports for a listed college; empty when none are known (the person then uses "Other"). */
export function branchOptions(collegeName: string): ChoiceOption[] {
  const id = collegeId(collegeName);
  const table = (academics as unknown as { branches: BranchTable }).branches;
  const entry = id ? table[id] : undefined;
  return (entry?.options ?? []).map((o) => ({ value: o.label, label: o.label, hint: o.hint }));
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Relevance: 0 label starts with the query, 1 a word in the label does,
 * 2 a keyword does, 3 the label or a keyword contains it, otherwise no match.
 * Ties keep the original order, so a curated list stays predictable. An empty
 * query returns everything unchanged.
 */
export function rankOptions(options: ChoiceOption[], query: string): ChoiceOption[] {
  const q = norm(query);
  if (!q) return options;
  const scored: { o: ChoiceOption; score: number; i: number }[] = [];
  options.forEach((o, i) => {
    const label = norm(o.label);
    const words = label.split(" ");
    const keys = (o.keywords ?? []).map(norm);
    let score = -1;
    if (label.startsWith(q)) score = 0;
    else if (words.some((w) => w.startsWith(q))) score = 1;
    else if (keys.some((k) => k.startsWith(q))) score = 2;
    else if (label.includes(q) || keys.some((k) => k.includes(q))) score = 3;
    if (score >= 0) scored.push({ o, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.o);
}

/** An option whose label matches the text exactly (ignoring case and spacing). */
export function exactOption(options: ChoiceOption[], text: string): ChoiceOption | undefined {
  const t = norm(text);
  return t ? options.find((o) => norm(o.label) === t) : undefined;
}
