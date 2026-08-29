import { prisma } from "../../src/lib/prisma.js";

// Every table defined in prisma/schema.prisma, by its actual table name as
// verified in prisma/migrations/*/migration.sql - the four Better Auth
// models are @@map'd to lowercase, everything else uses its default
// PascalCase model name. TRUNCATE ... CASCADE follows FK references
// regardless of each relation's own onDelete action (several are
// Restrict, not Cascade), so a single statement naming every table clears
// all state reliably without hitting FK errors or needing to hand-order
// deletes. Update this list if prisma/schema.prisma gains a new model.
const ALL_TABLES = [
  '"user"',
  '"session"',
  '"account"',
  '"verification"',
  '"Workspace"',
  '"WorkspaceMember"',
  '"Project"',
  '"Task"',
  '"Comment"',
  '"Attachment"',
  '"Activity"',
  '"Sprint"',
  '"Notification"',
  '"WorkspaceInvitation"',
];

// The one database this harness is ever allowed to reset - matches
// .env.test.example's documented one-time setup step. Deliberately not
// derived from NODE_ENV (that only reflects the app's own runtime mode,
// not which database DATABASE_URL happens to point at). Exported so
// tests/setup/env-example-parity.test.ts can assert .env.test.example's own
// DATABASE_URL targets this same name, rather than hardcoding "teamos_test"
// a second time.
export const EXPECTED_TEST_DATABASE_NAME = "teamos_test";

/**
 * Independent safety check, re-read every call rather than cached, so a
 * value assigned once at import time can't drift out of sync with what
 * resetDatabase() is actually about to run TRUNCATE against. Parses the
 * database name out of DATABASE_URL via the URL API rather than matching
 * the whole connection string as a substring - a host, username, or
 * password that happens to contain "teamos_test" (or "teamos") elsewhere
 * in the string must not satisfy this check.
 */
function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set - refusing to reset an unknown database.");
  }

  let databaseName: string;

  try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  } catch {
    // Deliberately doesn't interpolate databaseUrl (or any part of it) into
    // this message - a malformed connection string is exactly the kind of
    // value that's plausible to end up here via a mistyped or half-pasted
    // real credential, and this error is the sort of thing that can end up
    // in logs or crash reports.
    throw new Error("DATABASE_URL is not a valid connection string.");
  }

  if (databaseName !== EXPECTED_TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing to reset database "${databaseName}" - this test harness only permits ` +
        `resetting "${EXPECTED_TEST_DATABASE_NAME}". This check exists specifically to ` +
        "prevent accidentally truncating the real development database.",
    );
  }
}

/**
 * Clears every application table. Intended for afterEach in test files
 * that mutate the database, so state never leaks between tests.
 */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase();

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${ALL_TABLES.join(", ")} CASCADE;`);
}
