import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { requireWorkspaceMembership } from "../../shared/authorization/workspace-access.js";

import type {
  ActivityResponse,
  CreateActivityData,
  ListActivitiesOptions,
  ListActivitiesResult,
} from "./activity.types.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

type ActivityWithActor = {
  id: string;

  type: ActivityResponse["type"];

  entityType: ActivityResponse["entityType"];
  entityId: string;

  taskId: string | null;
  projectId: string | null;

  metadata: Record<string, unknown> | null;

  createdAt: Date;

  actor: {
    id: string;
    name: string;
    image: string | null;
  };
};

function toActivityResponse(activity: ActivityWithActor): ActivityResponse {
  return {
    id: activity.id,

    type: activity.type,

    entityType: activity.entityType,
    entityId: activity.entityId,

    taskId: activity.taskId,
    projectId: activity.projectId,

    metadata: activity.metadata,

    createdAt: activity.createdAt,

    actor: {
      id: activity.actor.id,
      name: activity.actor.name,
      image: activity.actor.image,
    },
  };
}

/**
 * `client` defaults to the global `prisma` singleton, preserving every
 * existing caller's behavior unchanged (attachment/comments/workspace/
 * invitation services still call this with just `data`, still outside any
 * transaction). Callers that need the entity mutation and this activity
 * write to commit or roll back together - see task/sprint/sprint-task/
 * project services - pass their `$transaction` callback's `tx` explicitly.
 * `Prisma.TransactionClient` is what Prisma's own callback parameter is
 * typed as; `PrismaClient` satisfies it structurally (it has every member
 * `Prisma.TransactionClient` requires, plus more), so the same parameter
 * accepts either without a cast or `any`.
 *
 * Returns a callback that performs the ACTIVITY_CREATED emit, rather than
 * emitting directly, because `client.activity.create` above is only ever
 * genuinely durable once whatever transaction it ran inside has committed -
 * for the default `client = prisma` path that's true the instant this
 * function's own write resolves (autocommit, no surrounding transaction),
 * but for a `tx` passed in by a caller's `prisma.$transaction(async (tx) =>
 * {...})`, this write is only staged until that callback returns and Prisma
 * issues COMMIT. Emitting immediately in the `tx` case - the previous
 * behavior - could tell a realtime client about an activity (and, by
 * implication, whatever entity write shares its transaction) that a later
 * statement in the same transaction then rolls back.
 *
 * `client === prisma` is a safe, exact way to distinguish the two cases:
 * `prisma` is the module-level singleton default; the `tx` object Prisma
 * hands to a `$transaction` callback is verified (see
 * tests/activity/transactional-writes.test.ts's own comment) to be a
 * genuinely distinct object, never referentially equal to it. For that
 * default/non-transactional path, this already emits before returning -
 * matching every existing non-transactional caller's behavior exactly,
 * with no change required at any of those call sites - and hands back a
 * no-op so calling the return value is always safe but never double-emits.
 * Transactional callers must collect the real returned callback and invoke
 * it themselves only after their `$transaction(...)` call resolves.
 */
export async function createActivity(
  data: CreateActivityData,
  client: Prisma.TransactionClient = prisma,
): Promise<() => void> {
  const activityData = {
    workspaceId: data.workspaceId,
    actorId: data.actorId,

    type: data.type,

    entityType: data.entityType,
    entityId: data.entityId,

    ...(data.taskId !== undefined && { taskId: data.taskId }),
    ...(data.projectId !== undefined && { projectId: data.projectId }),

    ...(data.metadata && {
      metadata: data.metadata as Prisma.InputJsonValue,
    }),
  };

  const activity = await client.activity.create({
    data: activityData,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  const response = toActivityResponse(activity as ActivityWithActor);

  const emit = () => {
    emitToWorkspace(activity.workspaceId, REALTIME_EVENTS.ACTIVITY_CREATED, {
      workspaceId: activity.workspaceId,
      activity: response,
    });
  };

  if (client === prisma) {
    emit();
    return () => {};
  }

  return emit;
}

export async function listWorkspaceActivities(
  actorId: string,
  options: ListActivitiesOptions,
): Promise<ListActivitiesResult> {
  await requireWorkspaceMembership(options.workspaceId, actorId);

  const skip = (options.page - 1) * options.limit;

  const where = {
    workspaceId: options.workspaceId,

    ...(options.entityType &&
      options.entityId && {
        entityType: options.entityType,
        entityId: options.entityId,
      }),

    ...(options.taskId && {
      taskId: options.taskId,
    }),

    ...(options.projectId && {
      projectId: options.projectId,
    }),
  };

  const [total, activities] = await Promise.all([
    prisma.activity.count({
      where,
    }),

    prisma.activity.findMany({
      where,

      include: {
        actor: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },

      orderBy: [{ createdAt: "desc" }, { id: "desc" }],

      skip,
      take: options.limit,
    }),
  ]);

  return {
    activities: activities.map((activity) =>
      toActivityResponse(activity as ActivityWithActor),
    ),

    total,
  };
}
