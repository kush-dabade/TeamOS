import { Prisma } from "../../generated/prisma/client.js";

/**
 * True for Prisma's "record not found" error (P2025) - thrown by
 * update()/delete() when the target row is gone by the time the statement
 * runs, e.g. two concurrent requests deleting/updating the same row. Not a
 * general Prisma-error abstraction - just this one specific, common race
 * that multiple services need to translate into a typed NotFoundError.
 */
export function isRecordNotFoundError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
