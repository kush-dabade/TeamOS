import { prisma } from "../../lib/prisma.js";

import type {
  CommentResponse,
  CreateCommentData,
  DeleteCommentOptions,
  ListCommentsOptions,
  UpdateCommentData,
} from "./comments.types.js";

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

type CommentWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
};

function toCommentResponse(comment: CommentWithAuthor): CommentResponse {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      image: comment.author.image,
    },
  };
}

export async function createComment(
  actorId: string,
  data: CreateCommentData,
): Promise<CommentResponse> {
  const task = await prisma.task.findFirst({
    where: {
      id: data.taskId,
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
    throw new Error("Guests cannot create comments");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be modified");
  }

  const comment = await prisma.comment.create({
    data: {
      workspaceId: task.workspaceId,
      taskId: task.id,
      authorId: actorId,
      content: data.content,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  await createActivity({
    workspaceId: task.workspaceId,
    actorId,

    type: ActivityType.COMMENT_CREATED,

    entityType: ActivityEntityType.COMMENT,
    entityId: comment.id,

    metadata: {
      taskId: task.id,
    },
  });

  if (task.assigneeId && task.assigneeId !== actorId) {
    try {
      await enqueueNotification({
        workspaceId: task.workspaceId,
        recipientId: task.assigneeId,
        type: NotificationType.COMMENT_ON_ASSIGNED_TASK,
        title: "New Comment",
        message: `A new comment was added to "${task.title}".`,
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          commentId: comment.id,
          commentAuthorName: comment.author.name,
        },
      });
    } catch (error) {
      console.error("Failed to create comment notification:", error);
    }
  }

  const response = toCommentResponse(comment);

  emitToWorkspace(task.workspaceId, REALTIME_EVENTS.COMMENT_CREATED, {
    workspaceId: task.workspaceId,
    taskId: task.id,
    comment: response,
  });

  return response;
}

export async function listComments(
  actorId: string,
  options: ListCommentsOptions,
): Promise<CommentResponse[]> {
  const task = await prisma.task.findFirst({
    where: {
      id: options.taskId,
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

  const comments = await prisma.comment.findMany({
    where: {
      workspaceId: task.workspaceId,
      taskId: options.taskId,
      deletedAt: null,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return comments.map(toCommentResponse);
}

export async function updateComment(
  actorId: string,
  data: UpdateCommentData,
): Promise<CommentResponse> {
  const comment = await prisma.comment.findFirst({
    where: {
      id: data.commentId,
      deletedAt: null,
    },
    include: {
      task: {
        select: {
          projectId: true,
        },
      },
    },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  const membership = await getWorkspaceMembership(comment.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role === "GUEST") {
    throw new Error("Guests cannot edit comments");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: comment.task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be modified");
  }

  if (comment.authorId !== actorId) {
    throw new Error("You can only edit your own comments");
  }

  const updated = await prisma.comment.update({
    where: {
      id: comment.id,
    },
    data: {
      content: data.content,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  await createActivity({
    workspaceId: comment.workspaceId,
    actorId,

    type: ActivityType.COMMENT_UPDATED,

    entityType: ActivityEntityType.COMMENT,
    entityId: comment.id,

    metadata: {
      taskId: comment.taskId,
    },
  });

  const response = toCommentResponse(updated);

  emitToWorkspace(comment.workspaceId, REALTIME_EVENTS.COMMENT_UPDATED, {
    workspaceId: comment.workspaceId,
    taskId: comment.taskId,
    comment: response,
  });

  return response;
}

export async function deleteComment(
  actorId: string,
  options: DeleteCommentOptions,
): Promise<void> {
  const comment = await prisma.comment.findFirst({
    where: {
      id: options.commentId,
      deletedAt: null,
    },
    include: {
      task: {
        select: {
          projectId: true,
        },
      },
    },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  const membership = await getWorkspaceMembership(comment.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role === "GUEST") {
    throw new Error("Guests cannot delete comments");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: comment.task.projectId,
    },
  });

  if (project?.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be modified");
  }

  const canDelete =
    comment.authorId === actorId ||
    membership.role === "ADMIN" ||
    membership.role === "OWNER";

  if (!canDelete) {
    throw new Error("You do not have permission to delete this comment");
  }

  await prisma.comment.update({
    where: {
      id: comment.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  await createActivity({
    workspaceId: comment.workspaceId,
    actorId,

    type: ActivityType.COMMENT_DELETED,

    entityType: ActivityEntityType.COMMENT,
    entityId: comment.id,

    metadata: {
      taskId: comment.taskId,
    },
  });

  emitToWorkspace(comment.workspaceId, REALTIME_EVENTS.COMMENT_DELETED, {
    workspaceId: comment.workspaceId,
    taskId: comment.taskId,
    commentId: comment.id,
  });
}
