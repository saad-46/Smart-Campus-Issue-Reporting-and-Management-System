// ============================================
// Input validation
// ============================================
// Client-side validation gives fast feedback; firestore.rules enforces the
// same constraints server-side, since a client can always be bypassed.

import { CreateIssueData, IssueImage, Priority, UserRole } from "@/types";
import {
  DEFAULT_CATEGORY,
  DEFAULT_PRIORITY,
  ISSUE_CATEGORIES,
  LIMITS,
  PRIORITIES,
  SELF_ASSIGNABLE_ROLES,
} from "./constants";
import { ValidationError } from "./errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stored images are always inline base64 data URLs of these types. */
const DATA_IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Strip control characters (keeps newlines/tabs when multiline) and trim. */
export function cleanText(value: unknown, multiline = false): string {
  if (typeof value !== "string") return "";
  const pattern = multiline
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;
  const stripped = value.replace(pattern, multiline ? "" : " ");
  return multiline ? stripped.trim() : stripped.replace(/\s+/g, " ").trim();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Returns an error message, or null when the password is acceptable. */
export function getPasswordError(password: string): string | null {
  if (password.length < LIMITS.passwordMin) {
    return `Password must be at least ${LIMITS.passwordMin} characters.`;
  }
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export function validateRegistration(input: RegistrationInput): RegistrationInput {
  const name = cleanText(input.name);
  const email = cleanText(input.email).toLowerCase();

  if (!name) throw new ValidationError("Please enter your full name.");
  if (name.length > LIMITS.name) {
    throw new ValidationError(`Name must be ${LIMITS.name} characters or fewer.`);
  }
  if (!isValidEmail(email)) throw new ValidationError("Please enter a valid email address.");

  const passwordError = getPasswordError(input.password);
  if (passwordError) throw new ValidationError(passwordError);

  if (!SELF_ASSIGNABLE_ROLES.includes(input.role)) {
    throw new ValidationError("That role can't be selected at registration.");
  }

  return { name, email, password: input.password, role: input.role };
}

export function validateIssueInput(input: CreateIssueData): CreateIssueData {
  const title = cleanText(input.title);
  const description = cleanText(input.description, true);
  const location = cleanText(input.location);

  if (!title) throw new ValidationError("Please enter a title for the issue.");
  if (title.length > LIMITS.title) {
    throw new ValidationError(`Title must be ${LIMITS.title} characters or fewer.`);
  }
  if (!description) throw new ValidationError("Please describe the issue.");
  if (description.length > LIMITS.description) {
    throw new ValidationError(`Description must be ${LIMITS.description} characters or fewer.`);
  }
  if (!location) throw new ValidationError("Please enter a location.");
  if (location.length > LIMITS.location) {
    throw new ValidationError(`Location must be ${LIMITS.location} characters or fewer.`);
  }

  return { title, description, location };
}

/** AI output is an untrusted suggestion: anything unexpected falls back to a safe default. */
export function normalizeCategory(value: unknown): string {
  return typeof value === "string" && (ISSUE_CATEGORIES as readonly string[]).includes(value)
    ? value
    : DEFAULT_CATEGORY;
}

export function normalizePriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : DEFAULT_PRIORITY;
}

export function isSafeImageDataUrl(value: unknown, maxChars: number = LIMITS.imageChars): value is string {
  return typeof value === "string" && value.length <= maxChars && DATA_IMAGE_PATTERN.test(value);
}

/**
 * Whether a stored image URL may be rendered. Only inline images (and
 * Firebase Storage URLs from older documents) are allowed, so a hostile
 * document can't point <img>/<a> at javascript: or third-party URLs.
 */
export function isDisplayableImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  return value.startsWith("https://firebasestorage.googleapis.com/");
}

export function validateImages(images: IssueImage[]): IssueImage[] {
  if (images.length > LIMITS.maxImages) {
    throw new ValidationError(`You can attach at most ${LIMITS.maxImages} images.`);
  }
  for (const image of images) {
    if (
      !isSafeImageDataUrl(image?.full, LIMITS.imageChars) ||
      !isSafeImageDataUrl(image?.thumb, LIMITS.thumbChars)
    ) {
      throw new ValidationError("One of the images couldn't be processed. Please remove it and try again.");
    }
  }
  return images;
}

/** Parse a money amount typed by a user. Throws ValidationError when invalid. */
export function parseAmount(value: string | number, max: number): number {
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Please enter an amount greater than 0.");
  }
  if (amount > max) {
    throw new ValidationError(`Amount can't be more than ₹${max.toLocaleString()}.`);
  }
  // Money is stored to at most 2 decimal places.
  return Math.round(amount * 100) / 100;
}

/** "What was it spent on?" for an expense claim: optional, single line, capped. */
export function validateClaimDescription(text: unknown): string {
  const cleaned = cleanText(text);
  if (cleaned.length > LIMITS.claimDescription) {
    throw new ValidationError(`Keep the description to ${LIMITS.claimDescription} characters or fewer.`);
  }
  return cleaned;
}

export function validateChatMessage(text: string): string {
  const cleaned = cleanText(text, true);
  if (!cleaned) throw new ValidationError("Message can't be empty.");
  if (cleaned.length > LIMITS.chatMessage) {
    throw new ValidationError(`Message must be ${LIMITS.chatMessage} characters or fewer.`);
  }
  return cleaned;
}
