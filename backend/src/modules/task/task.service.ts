import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import type { Task } from "../../generated/prisma/client.js";

import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import {
  findWorkspaceMembership,
  requireWorkspaceMembership,
} from "../../shared/authorization/workspace-access.js";

import type {
  CreateTaskData,
  ListTasksOptions,
  ListWorkspaceTasksOptions,
  UpdateTaskData,
} from "./task.types.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { createActivity } from "../activity/activity.service.js";
import { enqueueNotification } from "../../queues/notification/index.js";

import {
  ActivityEntityType,
  ActivityType,
  NotificationType,
} from "../../generated/prisma/enums.js";

export function toTaskResponse(task: Task) {
  return {
    id: task.id,

    workspaceId: task.workspaceId,
    projectId: task.projectId,

    title: task.title,
    description: task.description,

    status: task.status,
    priority: task.priority,

    dueDate: task.dueDate,

    createdById: task.createdById,
    assigneeId: task.assigneeId,

    completedAt: task.completedAt,

    sprintId: task.sprintId,

    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function createTask(actorId: string, data: CreateTaskData) {
  const project = await prisma.project.findUnique({
    where: {
      id: data.projectId,
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await requireWorkspaceMembership(project.workspaceId, actorId);

  if (membership.role === "GUEST") {
    throw new ForbiddenError("Guests cannot create tasks");
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  if (data.assigneeId) {
    // Not an actor-authorization check: this validates that the assignee
    // (a different user than the actor) is a workspace member, so it stays
    // a ValidationError rather than going through the ForbiddenError-only
    // authorization primitive.
    const assigneeMembership = await findWorkspaceMembership(
      project.workspaceId,
      data.assigneeId,
    );

    if (!assigneeMembership) {
      throw new ValidationError("Assignee must be a workspace member");
    }
  }

  // createActivity(..., tx) only stages the activity row inside this
  // transaction - it can't safely emit ACTIVITY_CREATED yet, since the
  // transaction might still roll back after this callback returns. It hands
  // back a callback that performs that emit instead; this is invoked below
  // only once $transaction has actually resolved, so a client is never told
  // about an activity whose write didn't durably commit.
  let emitActivityCreated: () => void = () => {};

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: data.projectId,

        title: data.title,

        createdById: actorId,

        ...(data.description !== undefined && {
          description: data.description,
        }),

        ...(data.priority !== undefined && {
          priority: data.priority,
        }),

        ...(data.dueDate !== undefined && {
          dueDate: data.dueDate,
        }),

        ...(data.assigneeId !== undefined && {
          assigneeId: data.assigneeId,
        }),
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: project.workspaceId,
        actorId,

        type: ActivityType.TASK_CREATED,

        entityType: ActivityEntityType.TASK,
        entityId: createdTask.id,

        taskId: createdTask.id,
        projectId: createdTask.projectId,

        metadata: {
          taskTitle: createdTask.title,
        },
      },
      tx,
    );

    return createdTask;
  });

  emitActivityCreated();

  if (task.assigneeId && task.assigneeId !== actorId) {
    try {
      await enqueueNotification({
        workspaceId: task.workspaceId,

        recipientId: task.assigneeId,

        type: NotificationType.TASK_ASSIGNED,

        title: "Task Assigned",

        message: `You were assigned "${task.title}".`,

        // Task creation is one-time - its own id already uniquely
        // identifies this event (unlike the reassignment call site below,
        // which needs a version marker since the same task can be
        // reassigned again later).
        eventId: task.id,

        metadata: {
          taskId: task.id,
          taskTitle: task.title,
        },
      });
    } catch (error) {
      // Best-effort: the task mutation itself already succeeded - only the
      // supplementary notification failed to be created.
      logger.warn({ err: error }, "Failed to create notification");
    }
  }

  const response = toTaskResponse(task);

  emitToWorkspace(task.workspaceId, REALTIME_EVENTS.TASK_CREATED, {
    workspaceId: task.workspaceId,
    task: response,
  });

  return response;
}

export async function listTasks(actorId: string, options: ListTasksOptions) {
  const project = await prisma.project.findUnique({
    where: {
      id: options.projectId,
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  await requireWorkspaceMembership(project.workspaceId, actorId);

  const where = {
    projectId: options.projectId,
    deletedAt: null,
  };

  const skip = (options.page - 1) * options.limit;

  const [total, tasks] = await Promise.all([
    prisma.task.count({
      where,
    }),

    prisma.task.findMany({
      where,

      orderBy: [{ createdAt: "desc" }, { id: "desc" }],

      skip,
      take: options.limit,
    }),
  ]);

  return {
    tasks: tasks.map(toTaskResponse),
    total,
  };
}

/**
 * Workspace-wide equivalent of listTasks - deliberately a separate query
 * rather than listTasks with an optional projectId, since the two have
 * different authorization shapes: listTasks derives workspace membership
 * from a looked-up project, this checks membership directly against the
 * workspaceId from the URL and scopes the Prisma query to it, without ever
 * loading a project or trusting anything on the Task rows themselves for
 * that check. Exists so frontend consumers that need "every task across
 * every project in a workspace" (the Tasks page, dashboard widgets) no
 * longer have to fan out one request per project and cap each at 100 -
 * see use-tasks.ts's own comment on that gap.
 */
export async function listWorkspaceTasks(
  actorId: string,
  options: ListWorkspaceTasksOptions,
) {
  await requireWorkspaceMembership(options.workspaceId, actorId);

  const where = {
    workspaceId: options.workspaceId,
    deletedAt: null,
  };

  const skip = (options.page - 1) * options.limit;

  const [total, tasks] = await Promise.all([
    prisma.task.count({
      where,
    }),

    prisma.task.findMany({
      where,

      orderBy: [{ createdAt: "desc" }, { id: "desc" }],

      skip,
      take: options.limit,
    }),
  ]);

  return {
    tasks: tasks.map(toTaskResponse),
    total,
  };
}

export async function getTaskById(actorId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  await requireWorkspaceMembership(task.workspaceId, actorId);

  return toTaskResponse(task);
}

export async function deleteTask(actorId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const membership = await requireWorkspaceMembership(task.workspaceId, actorId);

  if (membership.role === "GUEST") {
    throw new ForbiddenError("Guests cannot delete tasks");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  let emitActivityCreated: () => void = () => {};

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: task.workspaceId,
        actorId,

        type: ActivityType.TASK_DELETED,

        entityType: ActivityEntityType.TASK,
        entityId: task.id,

        taskId: task.id,
        projectId: task.projectId,

        metadata: {
          taskTitle: task.title,
        },
      },
      tx,
    );
  });

  emitActivityCreated();

  emitToWorkspace(task.workspaceId, REALTIME_EVENTS.TASK_DELETED, {
    workspaceId: task.workspaceId,
    task: toTaskResponse(task),
  });
}

export async function updateTask(
  actorId: string,
  taskId: string,
  data: UpdateTaskData,
) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const membership = await requireWorkspaceMembership(task.workspaceId, actorId);

  if (membership.role === "GUEST") {
    throw new ForbiddenError("Guests cannot update tasks");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  if (data.assigneeId !== undefined && data.assigneeId !== null) {
    // Not an actor-authorization check: this validates that the assignee
    // (a different user than the actor) is a workspace member, so it stays
    // a ValidationError rather than going through the ForbiddenError-only
    // authorization primitive.
    const assigneeMembership = await findWorkspaceMembership(
      task.workspaceId,
      data.assigneeId,
    );

    if (!assigneeMembership) {
      throw new ValidationError("Assignee must be a workspace member");
    }
  }

  const oldStatus = task.status;

  const updateData: {
    title?: string;
    description?: string | null;
    status?: typeof task.status;
    priority?: typeof task.priority;
    assigneeId?: string | null;
    dueDate?: Date | null;
    completedAt?: Date | null;
  } = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
  }

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  if (data.priority !== undefined) {
    updateData.priority = data.priority;
  }

  if (data.assigneeId !== undefined) {
    updateData.assigneeId = data.assigneeId;
  }

  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate;
  }

  if (data.status === "DONE" && oldStatus !== "DONE") {
    updateData.completedAt = new Date();
  }

  if (
    oldStatus === "DONE" &&
    data.status !== undefined &&
    data.status !== "DONE"
  ) {
    updateData.completedAt = null;
  }

  // The status-changed/completed activity writes must commit or roll back
  // atomically with the entity update itself (this function's whole reason
  // for being transactional). enqueueNotification is a BullMQ/Redis call,
  // not a Postgres write - it can't participate in this transaction and
  // has no business holding it open, so it's deliberately run after the
  // transaction resolves instead of in its old position between the entity
  // update and the activity writes. This also means a notification is only
  // ever sent for an assignment that's genuinely committed, not one that
  // might still roll back.
  // Both branches below are independently conditional (a status change can
  // fire neither, either, or both), so this collects only the callbacks for
  // activities actually created, in the same order they were created in -
  // preserved below by emitting in array order once the transaction commits.
  const emitActivityCreatedCallbacks: Array<() => void> = [];

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: {
        id: task.id,
      },

      data: updateData,
    });

    if (data.status !== undefined && oldStatus !== updated.status) {
      emitActivityCreatedCallbacks.push(
        await createActivity(
          {
            workspaceId: task.workspaceId,
            actorId,

            type: ActivityType.TASK_STATUS_CHANGED,

            entityType: ActivityEntityType.TASK,
            entityId: updated.id,

            taskId: updated.id,
            projectId: updated.projectId,

            metadata: {
              oldStatus,
              newStatus: updated.status,
            },
          },
          tx,
        ),
      );
    }

    if (
      data.status !== undefined &&
      oldStatus !== "DONE" &&
      updated.status === "DONE"
    ) {
      emitActivityCreatedCallbacks.push(
        await createActivity(
          {
            workspaceId: task.workspaceId,
            actorId,

            type: ActivityType.TASK_COMPLETED,

            entityType: ActivityEntityType.TASK,
            entityId: updated.id,

            taskId: updated.id,
            projectId: updated.projectId,

            metadata: {
              taskTitle: updated.title,
            },
          },
          tx,
        ),
      );
    }

    return updated;
  });

  for (const emitActivityCreated of emitActivityCreatedCallbacks) {
    emitActivityCreated();
  }

  if (
    data.assigneeId !== undefined &&
    updatedTask.assigneeId !== null &&
    updatedTask.assigneeId !== task.assigneeId &&
    updatedTask.assigneeId !== actorId
  ) {
    try {
      await enqueueNotification({
        workspaceId: updatedTask.workspaceId,

        recipientId: updatedTask.assigneeId,

        type: NotificationType.TASK_ASSIGNED,

        title: "Task Assigned",

        message: `You were assigned "${updatedTask.title}".`,

        // A task can legitimately be reassigned again later, including back
        // to this same recipient - taskId+recipientId alone would collide
        // with that future reassignment. updatedAt is bumped by the
        // tx.task.update() above (Prisma's @updatedAt on Task), so it's a
        // real, already-persisted marker of THIS specific reassignment, not
        // a timestamp invented just for uniqueness.
        eventId: `${updatedTask.id}-${updatedTask.updatedAt.getTime()}`,

        metadata: {
          taskId: updatedTask.id,
          taskTitle: updatedTask.title,
        },
      });
    } catch (error) {
      // Best-effort: the task mutation itself already succeeded - only the
      // supplementary notification failed to be created.
      logger.warn({ err: error }, "Failed to create notification");
    }
  }

  const response = toTaskResponse(updatedTask);

  const payload = {
    workspaceId: updatedTask.workspaceId,
    task: response,
  };

  if (
    data.status !== undefined &&
    oldStatus !== "DONE" &&
    updatedTask.status === "DONE"
  ) {
    emitToWorkspace(
      updatedTask.workspaceId,
      REALTIME_EVENTS.TASK_COMPLETED,
      payload,
    );
  } else {
    emitToWorkspace(
      updatedTask.workspaceId,
      REALTIME_EVENTS.TASK_UPDATED,
      payload,
    );
  }

  return response;
}
