// ============================================
// Client-side image compression
// ============================================
// Images are stored inline (base64) inside the issue document, and a
// Firestore document is capped at 1 MiB. Every image is therefore
// re-encoded as JPEG and shrunk until it fits its budget.

import { ALLOWED_IMAGE_TYPES, LIMITS } from "./constants";
import { ValidationError } from "./errors";

const MAX_DIMENSIONS = [1280, 1024, 800, 640];
const THUMB_DIMENSIONS = [360, 280, 200, 140];
const QUALITIES = [0.8, 0.65, 0.5];

/** Validate a picked file's type and size. Throws ValidationError. */
export function assertImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ValidationError("Only JPG, PNG or WebP images are allowed.");
  }
  if (file.size > LIMITS.uploadMb * 1024 * 1024) {
    throw new ValidationError(`Image must be smaller than ${LIMITS.uploadMb}MB.`);
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ValidationError("Couldn't read that image. Please try another."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ValidationError("Couldn't read that image. Please try another."));
    img.src = src;
  });
}

/** Re-encode a data URL as a JPEG data URL no longer than maxChars. */
export async function compressDataUrl(
  dataUrl: string,
  maxChars: number = LIMITS.imageChars,
  maxDimensions: number[] = MAX_DIMENSIONS
): Promise<string> {
  const img = await loadImage(dataUrl);

  for (const maxDimension of maxDimensions) {
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    // JPEG has no alpha channel: paint white behind transparent PNGs.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (result.length <= maxChars) return result;
    }
  }

  throw new ValidationError("That image is too large to attach. Please try a smaller one.");
}

/** Small preview stored in the issue document and shown in lists. */
export function makeThumbnail(dataUrl: string): Promise<string> {
  return compressDataUrl(dataUrl, LIMITS.thumbChars, THUMB_DIMENSIONS);
}

/** Validate and compress a picked image file into a storable data URL. */
export async function fileToCompressedDataUrl(
  file: File,
  maxChars: number = LIMITS.imageChars
): Promise<string> {
  assertImageFile(file);
  return compressDataUrl(await readAsDataUrl(file), maxChars);
}
