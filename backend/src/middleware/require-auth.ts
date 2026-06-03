import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        },
      });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };

    next();
  } catch (error) {
    // Log the error for debugging
    console.error("Authentication error:", error);

    // If it's a session/credential issue, return 401
    // For unexpected backend errors, return 500
    const isAuthError =
      error instanceof Error &&
      (error.message.includes("session") ||
        error.message.includes("token") ||
        error.message.includes("unauthorized"));

    if (isAuthError || !error) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        },
      });
    }

    // Internal backend error
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_BACKEND_ERROR",
        message: "Authentication service error",
      },
    });
  }
}
