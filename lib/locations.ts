// ============================================
// Campus locations (QR reporting) and SLA configuration
// ============================================

import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { CampusLocation, Priority, SlaConfig } from "@/types";
import { ValidationError } from "./errors";
import { ListenerErrorHandler } from "./firestore";
import { track } from "./listeners";
import { normalizeCampusLocation } from "./models";
import { NewLocationInput, isLocationIdShape, validateLocationInput } from "./sharedRules";
import { DEFAULT_SLA_CONFIG, normalizeSlaConfig, validateSlaHours } from "./intelligence/sla";

const LOCATIONS = "campusLocations";
/** Upper bound on QR locations loaded at once (admin-managed, normally far fewer). */
const MAX_LOCATIONS = 500;

export async function listCampusLocations(): Promise<CampusLocation[]> {
  const snap = await getDocs(query(collection(db, LOCATIONS), limit(MAX_LOCATIONS)));
  return snap.docs.map((d) => normalizeCampusLocation(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCampusLocation(id: string): Promise<CampusLocation | null> {
  if (!isLocationIdShape(id)) return null;
  const snap = await getDoc(doc(db, LOCATIONS, id));
  return snap.exists() ? normalizeCampusLocation(snap.id, snap.data()) : null;
}

// The input rules live in lib/sharedRules.ts so Explore Mode validates with the same code.
export { validateLocationInput };
export type { NewLocationInput };

/** Admin only (enforced by the rules). Fails if the id is already taken. */
export async function createCampusLocation(input: NewLocationInput): Promise<CampusLocation> {
  const loc = validateLocationInput(input);
  const ref = doc(db, LOCATIONS, loc.id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) throw new ValidationError("A location with this name already exists.");
    transaction.set(ref, { name: loc.name, buildingId: loc.buildingId, floor: loc.floor, room: loc.room, createdAt: serverTimestamp() });
  });
  return { ...loc, createdAt: new Date() };
}

export async function deleteCampusLocation(id: string): Promise<void> {
  await deleteDoc(doc(db, LOCATIONS, id));
}

/** Link printed on a location's QR code. */
export function qrReportUrl(origin: string, locationId: string): string {
  return `${origin.replace(/\/+$/, "")}/dashboard/report?location=${encodeURIComponent(locationId)}`;
}

// ---------- SLA configuration (config/sla) ----------

export function subscribeToSlaConfig(callback: (config: SlaConfig) => void, onError?: ListenerErrorHandler): () => void {
  return track(
    onSnapshot(
      doc(db, "config", "sla"),
      (snap) => callback(snap.exists() ? normalizeSlaConfig(snap.data()) : DEFAULT_SLA_CONFIG),
      (error) => {
        callback(DEFAULT_SLA_CONFIG); // the defaults still give a usable SLA view
        onError?.(error);
      }
    )
  );
}

export async function saveSlaConfig(hours: Record<Priority, number>): Promise<void> {
  const problem = validateSlaHours(hours);
  if (problem) throw new ValidationError(problem);
  await setDoc(doc(db, "config", "sla"), { High: hours.High, Medium: hours.Medium, Low: hours.Low, updatedAt: serverTimestamp() });
}
