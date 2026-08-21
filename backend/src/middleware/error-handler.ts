import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { APIError as BetterAuthAPIError } from "better-auth";

import { Prisma } from "../generated/prisma/client.js";

import { logger } from "../lib/logger.js";
import { ValidationError } from "../shared/errors/validation-error.js";
import { NotFoundError } from "../shared/errors/not-found-error.js";
import { ForbiddenError } from "../shared/errors/forbidden-error.js";
import { ConflictError } from "../shared/errors/conflict-error.js";
import { UnauthorizedError } from "../shared/errors/unauthorized-error.js";
import { RateLimitError } from "../shared/errors/rate-limit-error.js";
import { StorageError } from "../storage/errors/storage.error.js";

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
) {
  const body: ErrorEnvelope = {
    success: false,
    error: { code, message },
  };

  res.status(status).json(body);
}

function multerErrorMessage(error: multer.MulterError): string {
  if (error.code === "LIMIT_FILE_SIZE") {
    return "Uploaded file exceeds the maximum allowed size.";
  }

  return "Invalid file upload.";
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ValidationError) {
    return sendError(res, 400, "VALIDATION_ERROR", error.message);
  }

  if (error instanceof NotFoundError) {
    return sendError(res, 404, "NOT_FOUND", error.message);
  }

  if (error instanceof ForbiddenError) {
    return sendError(res, 403, "FORBIDDEN", error.message);
  }

  if (error instanceof ConflictError) {
    return sendError(res, 409, "CONFLICT", error.message);
  }

  if (error instanceof UnauthorizedError) {
    return sendError(res, 401, "AUTH_REQUIRED", error.message);
  }

  if (error instanceof RateLimitError) {
    if (error.retryAfterSeconds !== undefined) {
      res.setHeader("Retry-After", error.retryAfterSeconds.toString());
    }

    return sendError(res, 429, "RATE_LIMITED", error.message);
  }

  // Better Auth wraps every getSession() failure (auth-related or an
  // internal/infra failure) in its own APIError, already carrying a
  // correct HTTP status and a message it has already sanitized for
  // client exposure — no need to re-classify by message content.
  if (error instanceof BetterAuthAPIError) {
    if (error.statusCode >= 500) {
      logger.error({ err: error }, "Better Auth internal error");
    }

    return sendError(
      res,
      error.statusCode,
      error.body?.code ?? "AUTH_ERROR",
      error.message,
    );
  }

  if (error instanceof ZodError) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      error.issues[0]?.message ?? "Invalid request",
    );
  }

  if (error instanceof multer.MulterError) {
    return sendError(res, 400, "VALIDATION_ERROR", multerErrorMessage(error));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return sendError(res, 409, "CONFLICT", "Resource already exists");
    }

    if (error.code === "P2025") {
      return sendError(res, 404, "NOT_FOUND", "Resource not found");
    }

    logger.error({ err: error }, "Unhandled Prisma error");

    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "An internal error occurred",
    );
  }

  if (error instanceof StorageError) {
    logger.error({ err: error }, "Storage error");

    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "An internal error occurred",
    );
  }

  logger.error({ err: error }, "Unhandled error");

  return sendError(res, 500, "INTERNAL_ERROR", "An internal error occurred");
}
