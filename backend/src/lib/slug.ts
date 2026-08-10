import { ValidationError } from "../shared/errors/validation-error.js";

export function generateSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new ValidationError("Cannot generate slug from input: no valid alphanumeric characters found");
  }

  return slug;
}