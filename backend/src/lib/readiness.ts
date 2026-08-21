import type { RequestHandler } from "express";

import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import { rateLimitRedis } from "./redis.js";
import { isShuttingDown as defaultIsShuttingDown } from "./shutdown-state.js";

export interface ReadinessCheck {
  ok: boolean;
  /** Omitted when the check never actually ran (e.g. shutdown short-circuit). */
  latencyMs?: number;
}

// Only the one method call site this module actually uses - narrower than
// the real PrismaClient type, the same "structurally compatible narrower
// interface" pattern fatal-error-handler.ts already uses for `process`. The
// real `prisma` singleton satisfies this; tests inject a fake instead of
// sabotaging the real connection.
interface DatabaseHealthClient {
  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

interface RedisHealthClient {
  ping(): Promise<string>;
}

// Prisma has no built-in query timeout - without this, an unreachable/
// wedged Postgres would hang the readiness check indefinitely instead of
// reporting unhealthy. Mirrors auth.ts's enqueueEmailWithTimeout Promise.race
// shape (the only existing timeout precedent in this codebase); not
// extracted into a shared withTimeout() helper since this is still the only
// other call site.
const DATABASE_CHECK_TIMEOUT_MS = 1000;

export async function checkDatabase(
  client: DatabaseHealthClient = prisma,
): Promise<ReadinessCheck> {
  const start = Date.now();

  try {
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) => {
        setTimeout(
          () => reject(new Error("Database readiness check timed out")),
          DATABASE_CHECK_TIMEOUT_MS,
        );
      }),
    ]);

    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    // Degraded signal for an orchestrator, not an application failure - the
    // raw error (which can include connection details) is logged
    // server-side only and never reaches the response body.
    logger.warn({ err: error }, "Readiness check failed: database");

    return { ok: false, latencyMs: Date.now() - start };
  }
}

// rateLimitRedis, not the BullMQ `redis` connection - the latter is built
// with maxRetriesPerRequest: null (a BullMQ requirement for its blocking
// commands), which makes a command against an unreachable Redis retry
// indefinitely instead of failing fast. rateLimitRedis already carries
// commandTimeout: 500 (see redis.ts), which is what bounds this check - no
// extra Promise.race needed here.
export async function checkRedis(client: RedisHealthClient = rateLimitRedis): Promise<ReadinessCheck> {
  const start = Date.now();

  try {
    await client.ping();

    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    logger.warn({ err: error }, "Readiness check failed: redis");

    return { ok: false, latencyMs: Date.now() - start };
  }
}

export interface ReadinessHandlerOptions {
  checkDatabase?: (client?: DatabaseHealthClient) => Promise<ReadinessCheck>;
  checkRedis?: (client?: RedisHealthClient) => Promise<ReadinessCheck>;
  isShuttingDown?: () => boolean;
}

/**
 * Factory rather than only exporting a mounted route - same reason
 * createRequestIdMiddleware/createLogger are factories: tests inject fake
 * check functions (to prove the shutdown short-circuit never calls them, or
 * to prove both checks run concurrently) instead of depending on the real
 * Postgres/Redis singletons behaving a specific way on demand.
 */
export function createReadinessHandler({
  checkDatabase: checkDb = checkDatabase,
  checkRedis: checkRds = checkRedis,
  isShuttingDown = defaultIsShuttingDown,
}: ReadinessHandlerOptions = {}): RequestHandler {
  return async (_req, res) => {
    if (isShuttingDown()) {
      res.status(503).json({
        success: false,
        checks: {
          database: { ok: false },
          redis: { ok: false },
        },
      });

      return;
    }

    const [database, redis] = await Promise.all([checkDb(), checkRds()]);
    const success = database.ok && redis.ok;

    res.status(success ? 200 : 503).json({
      success,
      checks: { database, redis },
    });
  };
}
