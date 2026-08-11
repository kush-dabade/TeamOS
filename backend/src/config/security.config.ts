const nodeEnv = process.env.NODE_ENV ?? "development";

export const isProduction = nodeEnv === "production";

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
  const raw = process.env.TRUST_PROXY_HOPS ?? "0";
  const parsed = Number(raw);

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
