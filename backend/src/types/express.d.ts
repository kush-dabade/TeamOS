import "express";
import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        /**
         * Can be false once REQUIRE_EMAIL_VERIFICATION=false lets unverified
         * accounts sign in (see lib/auth.ts). Anything that authorizes on
         * `email` must check this first.
         */
        emailVerified: boolean;
      };
      /** Set by request-id.ts, mounted first in app.ts - present on every request. */
      id: string;
      /** Request-scoped child logger with `requestId` bound. Set alongside `id`. */
      log: Logger;
    }
  }
}

export {};