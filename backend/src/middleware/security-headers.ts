import type { NextFunction, Request, Response } from "express";

import { isProduction } from "../config/security.config.js";

// 180 days - a conservative starting value for a project still iterating on
// its production TLS setup, well short of the "eligible for preload" 1-year
// threshold. includeSubDomains/preload are deliberately not set: there is no
// documented subdomain topology to safely apply the former to, and preload
// is a public, essentially irreversible cross-browser commitment that
// deserves its own dedicated decision, not a default in a header-hardening
// commit.
const HSTS_MAX_AGE_SECONDS = 15552000;

// TeamOS's backend never serves HTML (no res.render/sendFile/static
// anywhere in src/) - it's a JSON API plus raw binary streaming for
// avatars/attachments. So this deliberately does NOT copy a Helmet-style
// HTML-app CSP: script-src/style-src/font-src/img-src/connect-src etc. all
// govern what a rendered HTML document may load, and no HTML document is
// ever rendered from this origin for them to have any target. default-src
// 'none' is the minimal safe catch-all OWASP recommends for non-HTML APIs;
// frame-ancestors 'none' is the modern, content-type-agnostic replacement
// for X-Frame-Options (also set below, for older clients that don't
// understand CSP).
const CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

/**
 * Mounted first in app.ts, before CORS/auth/body-parsing/rate limiting/
 * routes - res.setHeader calls persist on the response for the rest of the
 * request regardless of what happens afterward, including next(err)
 * jumping straight to errorHandler past all remaining non-error
 * middleware. Running first is what makes these headers show up on every
 * response this app ever sends, success or error, without having to
 * reason about each error path individually.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);

  // Must never be sent in development - the app runs over plain HTTP
  // locally, and a browser that received this header would then refuse to
  // connect over HTTP for the next max-age seconds, breaking local dev.
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", `max-age=${HSTS_MAX_AGE_SECONDS}`);
  }

  next();
}
