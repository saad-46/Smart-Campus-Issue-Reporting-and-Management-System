// ============================================
// Camera helpers (pure, browser-API free where possible)
// ============================================
// The live camera needs a secure context (HTTPS or localhost) and
// navigator.mediaDevices.getUserMedia. Phones are better served by the
// native camera app through <input capture>, so the live preview is for
// desktops and laptops (a coarse primary pointer means a touch device).

export interface CameraSupport {
  /** Can we open a live preview here? */
  live: boolean;
  /** Is this a touch-first device where the native capture input is the better path? */
  nativeCapture: boolean;
}

export function detectCameraSupport(env: {
  isSecureContext?: boolean;
  mediaDevices?: { getUserMedia?: unknown } | null;
  coarsePointer?: boolean;
}): CameraSupport {
  const live = !!env.isSecureContext && typeof env.mediaDevices?.getUserMedia === "function";
  return { live, nativeCapture: !!env.coarsePointer };
}

export type CameraFailure = "denied" | "no-camera" | "in-use" | "insecure" | "unsupported" | "other";

/** What went wrong with getUserMedia, in words a person can act on. */
export function describeCameraError(err: unknown): { reason: CameraFailure; message: string } {
  const name = typeof err === "object" && err && "name" in err ? String((err as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        reason: "denied",
        message: "Camera access is blocked. Allow the camera for this site in your browser's address-bar or site settings, then try again, or upload a photo instead.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return { reason: "no-camera", message: "No camera was found on this device. You can upload a photo instead." };
    case "NotReadableError":
    case "TrackStartError":
      return { reason: "in-use", message: "The camera is busy, possibly used by another app or tab. Close it and try again, or upload a photo instead." };
    case "TypeError":
      return { reason: "unsupported", message: "This browser can't open the camera here. You can upload a photo instead." };
    default:
      return { reason: "other", message: "The camera couldn't be started. You can upload a photo instead." };
  }
}

/** Why the live camera can't be offered at all, or null when it can. */
export function liveCameraBlocker(env: { isSecureContext?: boolean; mediaDevices?: { getUserMedia?: unknown } | null }): CameraFailure | null {
  if (!env.isSecureContext) return "insecure";
  if (typeof env.mediaDevices?.getUserMedia !== "function") return "unsupported";
  return null;
}
