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

/**
 * Clears every application table. Intended for afterEach in test files
 * that mutate the database, so state never leaks between tests.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${ALL_TABLES.join(", ")} CASCADE;`);
}
