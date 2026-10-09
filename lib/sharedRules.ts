// ============================================
// Input rules shared by the signed-in app and Explore Mode
// ============================================
// Pure functions with no Firebase import, so the signed-in data layer
// (lib/locations.ts, lib/feedback.ts) and the Explore demo engine
// (lib/viewer/demoStore.ts) validate with exactly the same code.

import { ValidationError } from "./errors";
import { getBuilding, slugifyLocation } from "./campus";
import { cleanText } from "./validation";

export interface NewLocationInput {
  name: string;
  buildingId: string;
  floor: string;
  room: string;
}

export function validateLocationInput(input: NewLocationInput): NewLocationInput & { id: string } {
  const name = cleanText(input.name).slice(0, 80);
  const floor = cleanText(input.floor).slice(0, 10);
  const room = cleanText(input.room).slice(0, 20);
  if (!name) throw new ValidationError("Give the location a name.");
  if (input.buildingId && !getBuilding(input.buildingId)) throw new ValidationError("Choose a building from the list.");
  const id = slugifyLocation([input.buildingId, name, room].filter(Boolean).join(" "));
  if (!id) throw new ValidationError("The name needs at least one letter or number.");
  return { id, name, buildingId: input.buildingId, floor, room };
}

/** Shape every location id must have before it is looked up (QR links are untrusted input). */
export function isLocationIdShape(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9-]{1,60}$/.test(id);
}

export const FEEDBACK_COMMENT_MAX = 500;

export function validateFeedbackInput(rating: number, comment: string): { rating: number; comment: string } {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError("Please choose a rating from 1 to 5 stars.");
  const text = cleanText(comment, true);
  if (text.length > FEEDBACK_COMMENT_MAX) throw new ValidationError(`Comments must be ${FEEDBACK_COMMENT_MAX} characters or fewer.`);
  return { rating, comment: text };
}

// ---------- Demo / real boundary ----------
// Explore Mode ids are recognisable on sight and can never be Firestore ids:
// issues are "SC-<number>", and every other demo record starts with "demo-".

const DEMO_ID = /^(SC-\d+|TX-\d+|demo-.*)$/;

export function isDemoId(id: unknown): boolean {
  return typeof id === "string" && DEMO_ID.test(id);
}

/** Called by every signed-in write: a demo record must never reach Firestore. */
export function assertRealId(id: unknown, what = "record"): void {
  if (isDemoId(id)) throw new ValidationError(`This ${what} belongs to the demo and can't be saved.`);
}
