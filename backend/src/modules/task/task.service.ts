import { prisma } from "../../lib/prisma.js";
import type { Task } from "../../generated/prisma/client.js";

import type {
  CreateTaskData,
  ListTasksOptions,
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

function toTaskResponse(task: Task) {
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

export async function createTask(actorId: string, data: CreateTaskData) {
  const project = await prisma.project.findUnique({
    where: {
      id: data.projectId,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be modified");
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

    taskId: task.id,
    projectId: task.projectId,

    metadata: {
      taskTitle: task.title,
    },
  });

  if (task.assigneeId && task.assigneeId !== actorId) {
    try {
      await enqueueNotification({
        workspaceId: task.workspaceId,

        recipientId: task.assigneeId,

        type: NotificationType.TASK_ASSIGNED,

        title: "Task Assigned",

        message: `You were assigned "${task.title}".`,

        metadata: {
          taskId: task.id,
          taskTitle: task.title,
        },
      });
    } catch (error) {
      console.error("Failed to create notification:", error);
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
    throw new Error("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: options.projectId,
      deletedAt: null,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return tasks.map(toTaskResponse);
}

export async function getTaskById(actorId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const membership = await getWorkspaceMembership(task.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

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
    throw new Error("Task not found");
  }

  const membership = await getWorkspaceMembership(task.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role === "GUEST") {
    throw new Error("Guests cannot delete tasks");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be modified");
  }

  await prisma.task.update({
    where: {
      id: task.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  await createActivity({
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
  });

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
    throw new Error("Task not found");
  }

  const membership = await getWorkspaceMembership(task.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role === "GUEST") {
    throw new Error("Guests cannot update tasks");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be modified");
  }

  if (data.assigneeId !== undefined && data.assigneeId !== null) {
    const assigneeMembership = await getWorkspaceMembership(
      task.workspaceId,
      data.assigneeId,
    );

    if (!assigneeMembership) {
      throw new Error("Assignee must be a workspace member");
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

  const updatedTask = await prisma.task.update({
    where: {
      id: task.id,
    },

    data: updateData,
  });

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

        metadata: {
          taskId: updatedTask.id,
          taskTitle: updatedTask.title,
        },
      });
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  }

  if (data.status !== undefined && oldStatus !== updatedTask.status) {
    await createActivity({
      workspaceId: task.workspaceId,
      actorId,

      type: ActivityType.TASK_STATUS_CHANGED,

      entityType: ActivityEntityType.TASK,
      entityId: updatedTask.id,

      taskId: updatedTask.id,
      projectId: updatedTask.projectId,

      metadata: {
        oldStatus,
        newStatus: updatedTask.status,
      },
    });
  }

  if (
    data.status !== undefined &&
    oldStatus !== "DONE" &&
    updatedTask.status === "DONE"
  ) {
    await createActivity({
      workspaceId: task.workspaceId,
      actorId,

      type: ActivityType.TASK_COMPLETED,

      entityType: ActivityEntityType.TASK,
      entityId: updatedTask.id,

      taskId: updatedTask.id,
      projectId: updatedTask.projectId,

      metadata: {
        taskTitle: updatedTask.title,
      },
    });
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
