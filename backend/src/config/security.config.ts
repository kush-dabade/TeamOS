const nodeEnv = process.env.NODE_ENV ?? "development";

export const isProduction = nodeEnv === "production";

// Deliberately NOT the same as `!isProduction`: that also covers "test"
// (Vitest sets NODE_ENV=test - see lib/logger.ts's comment on the same
// value), where the suite exercises the real, non-bypassed auth/security
// flows end-to-end (e.g. tests/security/email-verification.test.ts) and
// must keep doing so. This is specifically the local-development signal -
// true only when NODE_ENV is exactly "development" (this file's own
// default above when unset, matching bare `npm run dev`; docker-compose.yml
// sets it explicitly for the backend/worker services). isProduction and
// isLocalDevelopment can never both be true (they compare nodeEnv against
// two different literal values), so anything gated on this - e.g. lib/auth.ts's
// development-only email-verification bypass - is exactly as safe from
// activating in production as isProduction-gated behavior already is;
// this only narrows the non-production case further, it doesn't touch the
// production boundary itself.
export const isLocalDevelopment = nodeEnv === "development";

const DEFAULT_TRUSTED_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];

function parseTrustedOrigins(): string[] {
  const envOrigins = process.env.TRUSTED_ORIGINS;

  if (!envOrigins) {
    if (isProduction) {
      throw new Error(
        "TRUSTED_ORIGINS environment variable is required in production.",
      );
    }

    return DEFAULT_TRUSTED_ORIGINS;
  }

  const origins = envOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error("TRUSTED_ORIGINS must contain at least one origin.");
  }

  return origins;
}

function parseTrustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS;

  if (raw === undefined) {
    if (isProduction) {
      throw new Error(
        "TRUST_PROXY_HOPS environment variable is required in production (number of " +
          "reverse proxy hops between the client and this server - set to 0 if the API " +
          "is directly internet-facing with no reverse proxy in front of it). Silently " +
          "defaulting to 0 behind a real proxy would collapse every anonymous-IP " +
          "rate-limit bucket into one.",
      );
    }

    return 0;
  }

  // Number("") and Number("  ") both evaluate to 0, which would otherwise
  // pass the integer check below and silently accept an explicitly-set-but-
  // empty value as "0 hops" - trimming and checking for emptiness first
  // means a value that's present but blank is rejected the same way any
  // other malformed value is, not treated as equivalent to being unset.
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error(
      "TRUST_PROXY_HOPS must be a non-negative integer (number of reverse proxy hops between the client and this server).",
    );
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      "TRUST_PROXY_HOPS must be a non-negative integer (number of reverse proxy hops between the client and this server).",
    );
  }

  return parsed;
}

// Single source of truth for CORS/trustedOrigins config, consumed by
// app.ts (Express CORS), lib/auth.ts (Better Auth), and
// realtime/realtime.server.ts (Socket.IO CORS) - previously each parsed
// TRUSTED_ORIGINS (or, in app.ts's case, the unrelated FRONTEND_URL)
// independently, letting them silently diverge.
export const trustedOrigins = parseTrustedOrigins();
export const trustProxyHops = parseTrustProxyHops();
