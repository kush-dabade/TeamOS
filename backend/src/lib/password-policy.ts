import { randomBytes } from "node:crypto";

// The account rules the sign-up, reset-password, change-password and
// profile forms advertise, enforced on the server so they hold for every
// client (lib/auth.ts applies them in Better Auth's before-hook). The
// frontend validation schemas mirror these values; keep them in step.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USER_NAME_MAX_LENGTH = 50;

/** The first rule `password` breaks, as a user-facing message, or null. */
export function passwordPolicyViolation(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }

  return null;
}

/** A user-facing message if `name` is empty or too long once trimmed, or null. */
export function userNameViolation(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return "Name is required.";
  }

  if (trimmed.length > USER_NAME_MAX_LENGTH) {
    return `Name must be ${USER_NAME_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

/**
 * A random password for accounts nobody signs into by hand (demo users and
 * their teammates). 192 random bits as hex, plus a fixed "Aa1" so it always
 * satisfies the character rules above - hex alone has no uppercase letters
 * and would be rejected at sign-up.
 */
export function generateRandomCompliantPassword(): string {
  return `Aa1${randomBytes(24).toString("hex")}`;
}
