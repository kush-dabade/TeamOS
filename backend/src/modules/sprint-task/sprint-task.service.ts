import { prisma } from "../../lib/prisma.js";
import { createActivity } from "../activity/activity.service.js";

import type { Sprint } from "../../generated/prisma/client.js";

import {
  ActivityEntityType,
  ActivityType,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import {
  requireWorkspaceMembership,
  requireRole,
} from "../../shared/authorization/workspace-access.js";

async function findSprintById(sprintId: string) {
  return prisma.sprint.findUnique({
    where: {
      id: sprintId,
    },
  });
}

async function findProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });
}

async function findTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: {
      id: taskId,
    },
  });
}

async function validateProjectCanBeModified(projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  return project;
}

function validateSprintCanBeModified(sprint: Sprint) {
  if (sprint.status === "COMPLETED") {
    throw new ValidationError("Completed sprints cannot be modified");
  }
}

export async function assignTaskToSprint(
  userId: string,
  sprintId: string,
  taskId: string,
) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const membership = await requireWorkspaceMembership(sprint.workspaceId, userId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  validateSprintCanBeModified(sprint);

  const task = await findTaskById(taskId);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (task.deletedAt) {
    throw new ValidationError("Cannot assign deleted task");
  }

  if (task.workspaceId !== sprint.workspaceId) {
    throw new ValidationError(
      "Task and sprint must belong to the same workspace",
    );
  }

  if (task.projectId !== sprint.projectId) {
    throw new ValidationError(
      "Task and sprint must belong to the same project",
    );
  }

  await validateProjectCanBeModified(sprint.projectId);

  const previousSprint =
    task.sprintId && task.sprintId !== sprint.id
      ? await findSprintById(task.sprintId)
      : null;

  let emitActivityCreated: () => void = () => {};

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        sprintId: sprint.id,
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: updated.workspaceId,
        actorId: userId,

        type: ActivityType.TASK_ASSIGNED_TO_SPRINT,

        entityType: ActivityEntityType.TASK,
        entityId: updated.id,

        taskId: updated.id,
        projectId: updated.projectId,

        metadata: previousSprint
          ? {
              taskTitle: updated.title,
              previousSprint: previousSprint.name,
              newSprint: sprint.name,
            }
          : {
              taskTitle: updated.title,
              sprintName: sprint.name,
            },
      },
      tx,
    );

    return updated;
  });

  emitActivityCreated();

  emitToWorkspace(
    updatedTask.workspaceId,
    REALTIME_EVENTS.TASK_ASSIGNED_TO_SPRINT,
    {
      workspaceId: updatedTask.workspaceId,
      projectId: updatedTask.projectId,
      sprintId: sprint.id,
      task: {
        id: updatedTask.id,
        sprintId: updatedTask.sprintId,
        ...(previousSprint && {
          previousSprintId: previousSprint.id,
        }),
      },
    },
  );

  return updatedTask;
}

export async function removeTaskFromSprint(
  userId: string,
  sprintId: string,
  taskId: string,
) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const membership = await requireWorkspaceMembership(sprint.workspaceId, userId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  validateSprintCanBeModified(sprint);

  const task = await findTaskById(taskId);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (task.deletedAt) {
    throw new ValidationError("Cannot remove deleted task from sprint");
  }

  if (task.sprintId !== sprint.id) {
    throw new ValidationError("Task is not assigned to this sprint");
  }

  await validateProjectCanBeModified(sprint.projectId);

  let emitActivityCreated: () => void = () => {};

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        sprintId: null,
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: updated.workspaceId,
        actorId: userId,

        type: ActivityType.TASK_REMOVED_FROM_SPRINT,

        entityType: ActivityEntityType.TASK,
        entityId: updated.id,

        taskId: updated.id,
        projectId: updated.projectId,

        metadata: {
          taskTitle: updated.title,
          sprintName: sprint.name,
        },
      },
      tx,
    );

    return updated;
  });

  emitActivityCreated();

  emitToWorkspace(
    updatedTask.workspaceId,
    REALTIME_EVENTS.TASK_REMOVED_FROM_SPRINT,
    {
      workspaceId: updatedTask.workspaceId,
      projectId: updatedTask.projectId,
      sprintId: sprint.id,
      task: {
        id: updatedTask.id,
        sprintId: null,
      },
    },
  );

  return updatedTask;
}

export async function listSprintTasks(userId: string, sprintId: string) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  await requireWorkspaceMembership(sprint.workspaceId, userId);

  return prisma.task.findMany({
    where: {
      sprintId: sprint.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
