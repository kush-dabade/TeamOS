import { prisma } from "../../lib/prisma.js";

import type { CreateTaskData, ListTasksOptions } from "./task.types.js";

import { createActivity } from "../activity/activity.service.js";

import {
  ActivityEntityType,
  ActivityType,
} from "../../generated/prisma/enums.js";

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

export async function createTask(actorId: string, data: CreateTaskData) {
  const project = await prisma.project.findUnique({
    where: {
      id: data.projectId,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role === "GUEST") {
    throw new Error("Guests cannot create tasks");
  }

  if (data.assigneeId) {
    const assigneeMembership = await getWorkspaceMembership(
      project.workspaceId,
      data.assigneeId,
    );

    if (!assigneeMembership) {
      throw new Error("Assignee must be a workspace member");
    }
  }

  const task = await prisma.task.create({
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

  await createActivity({
    workspaceId: project.workspaceId,
    actorId,

    type: ActivityType.TASK_CREATED,

    entityType: ActivityEntityType.TASK,
    entityId: task.id,

    metadata: {
      taskTitle: task.title,
    },
  });

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

    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function listTasks(actorId: string, options: ListTasksOptions) {
  const project = await prisma.project.findUnique({
    where: {
      id: options.projectId,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: options.projectId,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return tasks.map((task) => ({
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

    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));
}
