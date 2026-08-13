// The Compose-orchestrated hostname/port for the postgres service - only
// used when assembling DATABASE_URL from discrete parts below, never in
// the DATABASE_URL-is-already-set branch (local, non-Docker development).
const POSTGRES_HOST = "postgres";
const POSTGRES_PORT = 5432;

/**
 * docker-compose.yml deliberately does NOT interpolate POSTGRES_USER/
 * POSTGRES_PASSWORD directly into a DATABASE_URL string - Compose's
 * variable interpolation is plain string substitution with no
 * percent-encoding support, so a credential containing a URI-reserved
 * character (@ : / # ? %) would produce a DATABASE_URL that fails to
 * parse or connects to the wrong place. Instead, migrate/backend/worker
 * all receive POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB as their own
 * discrete env vars (safe regardless of content, since Compose passes
 * each through as its own scalar value rather than combining them), and
 * this single shared function - imported by both prisma.config.ts and
 * lib/prisma.ts, so there is exactly one encoding implementation, not
 * three - assembles and percent-encodes the connection string here, where
 * encodeURIComponent is trivially available.
 *
 * DATABASE_URL itself still wins if already set (local, non-Docker
 * development via backend/.env, where a developer pastes their own
 * complete connection string) - this only constructs one when it isn't.
 */
function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  if (!user || !password || !database) {
    throw new Error(
      "Either DATABASE_URL, or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB, must be set.",
    );
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);

  return `postgresql://${encodedUser}:${encodedPassword}@${POSTGRES_HOST}:${POSTGRES_PORT}/${encodedDatabase}`;
}

export const databaseUrl = buildDatabaseUrl();
