import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";
import { UnauthorizedError } from "../shared/errors/unauthorized-error.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    throw new UnauthorizedError("Authentication required");
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  next();
}
