import "express";
import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
      /** Set by request-id.ts, mounted first in app.ts - present on every request. */
      id: string;
      /** Request-scoped child logger with `requestId` bound. Set alongside `id`. */
      log: Logger;
    }
  }
}

export {};