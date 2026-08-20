import { describe, expect, it } from "vitest";
import { Queue } from "bullmq";

import { redisConfig } from "../../src/config/redis.config.js";
import { QUEUE_NAMES } from "../../src/queues/queue.constants.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";

/**
 * F-08: backend/.env and backend/.env.test point at the same Redis
 * host/port/password. Without a separate logical DB, a job this test suite
 * enqueues (e.g. every sign-up's verification email, via
 * tests/setup/fixtures.ts's signUpTestUser) would be visible to - and
 * consumable by - a real `npm run worker` / `docker compose up worker`
 * process running against backend/.env's default DB, triggering a real
 * Resend call. redisConfig.db (sourced from REDIS_DB, see
 * src/config/redis.config.ts) is what prevents that: backend/.env.test sets
 * it to 1, every dev/prod deployment without REDIS_DB set stays on 0.
 *
 * This exercises the application's actual redisConfig and its real
 * emailQueue - not a second, hand-rolled queue - so it proves the isolation
 * this process's queues/clients genuinely have, not just that Redis DB 0
 * and DB 1 are technically separate keyspaces in general.
 */
describe("F-08: test/dev Redis DB isolation", () => {
  it("resolves the test process's Redis configuration to logical DB 1, not dev/prod's default of 0", () => {
    expect(redisConfig.db).toBe(1);
  });

  it("keeps a job added through the app's real email queue invisible to a client on the default dev/prod DB (0)", async () => {
    const job = await emailQueue.add("isolation-probe", { probe: true });

    // Same host/port/password as the app's own redisConfig - the only
    // difference is `db: 0`, i.e. exactly what a real dev/prod worker
    // connects to when REDIS_DB is unset. Only a Queue client (never a
    // Worker), so this never processes jobs - it only inspects what's
    // visible on that DB.
    const devDbQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: { ...redisConfig, db: 0 },
    });

    try {
      const visibleFromDevDb = await devDbQueue.getJob(job.id!);

      expect(visibleFromDevDb).toBeUndefined();

      const visibleFromTestDb = await emailQueue.getJob(job.id!);

      expect(visibleFromTestDb).toBeDefined();
    } finally {
      await devDbQueue.close();
      await job.remove();
    }
  });
});
