import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "../../src/generated/prisma/client.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";
import { prisma } from "../../src/lib/prisma.js";
import { generateSlug } from "../../src/lib/slug.js";
import { createWorkspace } from "../../src/modules/workspace/workspace.service.js";

import { resetDatabase } from "../setup/reset-database.js";

/**
 * createWorkspace's slug allocation under real PostgreSQL concurrency - not
 * mocked. Before the per-slug-root advisory lock
 * (workspace.service.ts's lockSlugAllocation), the availability check ran
 * outside the insert's transaction: eight concurrent creations with the
 * same name reliably produced one success and seven Workspace.slug unique
 * violations (P2002, surfaced to clients as 409). Mirrors
 * tests/sprint/sprint-active-invariant.test.ts's approach of firing the
 * racing calls concurrently against the real connection pool.
 */
describe("workspace slug allocation", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
  });

  // Direct inserts, like tests/demo/cleanup.test.ts's users - these owners
  // only need to exist, not to authenticate. User.id has no database
  // default (Better Auth supplies it on sign-up), so it's set explicitly.
  async function createOwners(count: number) {
    return Promise.all(
      Array.from({ length: count }, () => {
        const id = `slug-owner-${crypto.randomUUID()}`;

        return prisma.user.create({
          data: {
            id,
            name: "Slug Test Owner",
            email: `${id}@example.com`,
            emailVerified: true,
          },
        });
      }),
    );
  }

  it("gives eight concurrent same-name creations distinct sequential slugs, each with its owner membership", async () => {
    const name = `Slug Race ${crypto.randomUUID().slice(0, 8)}`;
    const baseSlug = generateSlug(name);
    const owners = await createOwners(8);

    const results = await Promise.allSettled(
      owners.map((owner) => createWorkspace({ name, ownerId: owner.id })),
    );

    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toEqual([]);

    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: { in: owners.map((owner) => owner.id) } },
      include: { members: true },
    });

    expect(workspaces.map((workspace) => workspace.slug).sort()).toEqual(
      [baseSlug, ...[2, 3, 4, 5, 6, 7, 8].map((n) => `${baseSlug}-${n}`)].sort(),
    );

    for (const owner of owners) {
      const owned = workspaces.filter((workspace) => workspace.ownerId === owner.id);

      expect(owned).toHaveLength(1);
      expect(owned[0]!.members).toEqual([
        expect.objectContaining({ userId: owner.id, role: WorkspaceRole.OWNER }),
      ]);
    }
  });

  it("gives concurrent creations with different names their own base slugs", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const names = ["Engineering", "Design", "Marketing", "Operations"].map(
      (team) => `${team} ${suffix}`,
    );
    const owners = await createOwners(names.length);

    const created = await Promise.all(
      names.map((name, index) => createWorkspace({ name, ownerId: owners[index]!.id })),
    );

    expect(created.map((workspace) => workspace.slug)).toEqual(
      names.map((name) => generateSlug(name)),
    );
  });

  it("still rejects a direct duplicate slug insert at the database level", async () => {
    const [owner, intruder] = await createOwners(2);
    const workspace = await createWorkspace({
      name: `Backstop ${crypto.randomUUID().slice(0, 8)}`,
      ownerId: owner!.id,
    });

    // Bypasses createWorkspace (and therefore its advisory lock) entirely -
    // the Workspace.slug unique index alone must still refuse this.
    const error = await prisma.workspace
      .create({ data: { name: "Intruder", slug: workspace.slug, ownerId: intruder!.id } })
      .then(
        () => null,
        (rejection: unknown) => rejection,
      );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");

    // Same two metadata shapes sprint.service.ts's isProjectIdUniqueViolation
    // accepts: `target` when Prisma maps the constraint itself, the driver
    // adapter's constraint fields otherwise.
    const meta = (error as Prisma.PrismaClientKnownRequestError).meta as {
      target?: unknown;
      driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
    };
    const fields = meta.target ?? meta.driverAdapterError?.cause?.constraint?.fields;

    expect(fields).toEqual(["slug"]);
  });

  // ---------------------------------------------------------------------
  // Overlapping candidate sequences. A base slug's candidates are base,
  // base-2, base-3, ... - so "<root>" and "<root>-2" (from a name that
  // itself ends in " 2") compete for the same slugs despite having
  // different base slugs. These force the exact interleaving instead of
  // hoping for it: the first creation's transaction is held open after it
  // has locked, chosen its slug, and inserted - but before it commits - and
  // the second creation is started only then. The test waits for
  // PostgreSQL itself to report the second session blocked on a lock, and
  // asserts WHICH lock: "advisory" means slug allocation was serialized;
  // "transactionid" would mean both chose the same slug and the second is
  // only waiting to fail the unique index.
  // ---------------------------------------------------------------------

  /**
   * Polls pg_stat_activity (not pg_locks - a transaction-id wait has a NULL
   * `database` there, so filtering pg_locks by database misses it) until a
   * session in this database is waiting on a lock, and returns that wait's
   * event name. Bounded, with a diagnostic on timeout.
   */
  async function waitForLockWait(timeoutMs = 5000): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<{ waitEvent: string }[]>(Prisma.sql`
        SELECT wait_event AS "waitEvent"
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND pid <> pg_backend_pid()
      `);

      if (rows[0]) {
        return rows[0].waitEvent;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error(
      `No session in this database was observed waiting on a lock within ${timeoutMs}ms - ` +
        "the competing createWorkspace never blocked behind the held transaction.",
    );
  }

  /**
   * Runs `heldName`'s createWorkspace with its transaction held open (locked,
   * slug chosen, rows inserted, not committed), then `contenderName`'s, and
   * returns both settled results plus the lock the contender waited on.
   * Always releases the held transaction and awaits both creations before
   * returning or throwing - afterEach must never reset the database under
   * work that is still running.
   */
  async function createWithHeldTransaction(heldName: string, contenderName: string) {
    const [heldOwner, contenderOwner] = await createOwners(2);

    let reachedHold = false;
    let markHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      markHeld = () => {
        reachedHold = true;
        resolve();
      };
    });

    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Only the next $transaction call - the held creation's - is wrapped;
    // the contender's runs the real implementation untouched.
    const realTransaction = prisma.$transaction.bind(prisma);

    vi.spyOn(prisma, "$transaction").mockImplementationOnce(((
      fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: Parameters<typeof realTransaction>[1],
    ) =>
      realTransaction(async (tx: Prisma.TransactionClient) => {
        const result = await fn(tx);

        markHeld();
        await released;

        return result;
      }, options)) as unknown as typeof prisma.$transaction);

    const heldCreation = createWorkspace({ name: heldName, ownerId: heldOwner!.id });
    let contenderCreation: ReturnType<typeof createWorkspace> | undefined;
    let waitEvent: string | undefined;

    try {
      // Fail fast if the held creation errors before reaching the hold,
      // rather than waiting out the test timeout. Only rethrows while the
      // hold hasn't been reached, so this side of the race can't become an
      // unhandled rejection later.
      await Promise.race([
        held,
        heldCreation.then(
          () => {
            if (!reachedHold) {
              throw new Error("Held creation committed without reaching the hold");
            }
          },
          (error: unknown) => {
            if (!reachedHold) {
              throw error;
            }
          },
        ),
      ]);

      contenderCreation = createWorkspace({ name: contenderName, ownerId: contenderOwner!.id });
      waitEvent = await waitForLockWait();
    } finally {
      release();
      await Promise.allSettled([heldCreation, contenderCreation]);
    }

    const [heldResult, contenderResult] = await Promise.allSettled([
      heldCreation,
      contenderCreation!,
    ]);

    return { heldResult, contenderResult, waitEvent };
  }

  // The random part sits mid-name so the root itself never ends in digits.
  function overlapRootName() {
    return `Overlap ${crypto.randomUUID().slice(0, 8)} Corp`;
  }

  it("serializes a numbered-base creation and a same-root creation that overlap on <root>-2 (numbered base held first)", async () => {
    const rootName = overlapRootName();
    const root = generateSlug(rootName);
    const [establisher] = await createOwners(1);

    await createWorkspace({ name: rootName, ownerId: establisher!.id });

    // "<root>-2" is the held creation's own base slug; the contender (same
    // name as the existing root) also reaches "<root>-2" as its next
    // candidate.
    const { heldResult, contenderResult, waitEvent } = await createWithHeldTransaction(
      `${rootName} 2`,
      rootName,
    );

    expect(waitEvent).toBe("advisory");
    expect(heldResult).toEqual({
      status: "fulfilled",
      value: expect.objectContaining({ slug: `${root}-2` }),
    });
    expect(contenderResult).toEqual({
      status: "fulfilled",
      value: expect.objectContaining({ slug: `${root}-3` }),
    });
  });

  it("serializes a same-root creation and a numbered-base creation that overlap on <root>-2 (unnumbered base held first)", async () => {
    const rootName = overlapRootName();
    const root = generateSlug(rootName);
    const [establisher] = await createOwners(1);

    await createWorkspace({ name: rootName, ownerId: establisher!.id });

    // The held creation (same name as the existing root) takes "<root>-2";
    // the contender's own base slug is "<root>-2", so it must move on to
    // that base's next candidate, "<root>-2-2".
    const { heldResult, contenderResult, waitEvent } = await createWithHeldTransaction(
      rootName,
      `${rootName} 2`,
    );

    expect(waitEvent).toBe("advisory");
    expect(heldResult).toEqual({
      status: "fulfilled",
      value: expect.objectContaining({ slug: `${root}-2` }),
    });
    expect(contenderResult).toEqual({
      status: "fulfilled",
      value: expect.objectContaining({ slug: `${root}-2-2` }),
    });
  });
});
