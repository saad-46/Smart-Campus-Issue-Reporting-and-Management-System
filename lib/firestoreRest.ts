// ============================================
// Field-projected Firestore queries (REST runQuery)
// ============================================
// The web SDK always downloads whole documents. Issue documents carry
// photo thumbnails and long descriptions, so analytics, search and the map
// would pull megabytes they never use. Firestore's REST API supports a
// field projection (`select`); this module uses it with the signed-in
// user's ID token, so the request is evaluated against the same security
// rules as any SDK query.

import { auth, firestoreRestBase } from "./firebase";

type Primitive = string | number | boolean | null | Date;
type FieldValue = Primitive | FieldValue[] | { [key: string]: FieldValue };

export type FieldOp =
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "EQUAL"
  | "NOT_EQUAL"
  | "IN";

export interface ProjectionQuery {
  collection: string;
  select: string[];
  where?: { field: string; op: FieldOp; value: Primitive | Primitive[] }[];
  orderBy?: { field: string; direction: "ASCENDING" | "DESCENDING" };
  limit: number;
}

/** Error carrying a Firestore-style `code`, so getFriendlyErrorMessage() maps it. */
export class QueryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "QueryError";
  }
}

const TIMEOUT_MS = 20_000;

function encode(value: Primitive | Primitive[]): Record<string, unknown> {
  if (Array.isArray(value)) return { arrayValue: { values: value.map((v) => encode(v)) } };
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: value };
}

/** Decode a REST `Value` into a plain JS value (timestamps become Dates). */
export function decodeValue(value: Record<string, unknown> | undefined): FieldValue {
  if (!value) return null;
  if ("stringValue" in value) return String(value.stringValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) {
    const d = new Date(String(value.timestampValue));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: Record<string, unknown>[] })?.values ?? [];
    return values.map((v) => decodeValue(v));
  }
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
  }
  return null;
}

function codeForStatus(status: number): string {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "permission-denied";
  if (status === 404) return "not-found";
  if (status === 429) return "resource-exhausted";
  if (status === 400) return "failed-precondition";
  return "unavailable";
}

/**
 * Run a projected query. Returns [id, fields] pairs; field values are
 * decoded but otherwise untrusted — normalise them before use.
 */
export async function runProjectionQuery(q: ProjectionQuery): Promise<[string, Record<string, unknown>][]> {
  const user = auth.currentUser;
  if (!user) throw new QueryError("unauthenticated", "Not signed in");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new QueryError("unavailable", "Offline");
  }
  const token = await user.getIdToken();

  const filters = (q.where ?? []).map((w) => ({
    fieldFilter: { field: { fieldPath: w.field }, op: w.op, value: encode(w.value) },
  }));
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: q.collection }],
    select: { fields: q.select.map((fieldPath) => ({ fieldPath })) },
    limit: q.limit,
  };
  if (filters.length === 1) structuredQuery.where = filters[0];
  if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: "AND", filters } };
  if (q.orderBy) {
    structuredQuery.orderBy = [{ field: { fieldPath: q.orderBy.field }, direction: q.orderBy.direction }];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${firestoreRestBase}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ structuredQuery }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new QueryError(
      err instanceof DOMException && err.name === "AbortError" ? "deadline-exceeded" : "unavailable",
      "Query failed"
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new QueryError(codeForStatus(response.status), `Query failed (${response.status})`);

  const rows = (await response.json()) as { document?: { name: string; fields?: Record<string, Record<string, unknown>> } }[];
  return rows
    .filter((row) => row.document)
    .map((row) => {
      const doc = row.document as { name: string; fields?: Record<string, Record<string, unknown>> };
      const id = doc.name.slice(doc.name.lastIndexOf("/") + 1);
      const fields = Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, v]) => [k, decodeValue(v)]));
      return [id, fields] as [string, Record<string, unknown>];
    });
}
