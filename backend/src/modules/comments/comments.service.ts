import { prisma } from "../../lib/prisma.js";

import type {
  CommentResponse,
  CreateCommentData,
  ListCommentsOptions,
} from "./comments.types.js";

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
  const task = await prisma.task.findUnique({
    where: {
      id: data.taskId,
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

  return toCommentResponse(comment);
}

export async function listComments(
  actorId: string,
  options: ListCommentsOptions,
): Promise<CommentResponse[]> {
  const task = await prisma.task.findUnique({
    where: {
      id: options.taskId,
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
