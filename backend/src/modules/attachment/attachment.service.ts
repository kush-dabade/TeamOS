import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { storageService } from "../../storage/index.js";

import {
  ActivityEntityType,
  ActivityType,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

import { createActivity } from "../activity/activity.service.js";

import { ALLOWED_ATTACHMENT_MIME_TYPES } from "./attachment.config.js";

import type {
  AttachmentResponse,
  DownloadAttachmentResponse,
} from "./attachment.types.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

type AttachmentWithUploader = Prisma.AttachmentGetPayload<{
  include: {
    uploadedBy: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
  };
}>;

type AttachmentWithRelations = Prisma.AttachmentGetPayload<{
  include: {
    task: {
      select: {
        id: true;
        title: true;
        workspaceId: true;
      };
    };

    uploadedBy: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
  };
}>;

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace.");
  }

  return membership;
}

async function findTaskById(taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      workspaceId: true,
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found.");
  }

  return task;
}

async function findAttachmentById(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: {
      id: attachmentId,
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          workspaceId: true,
        },
      },

      uploadedBy: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  if (!attachment) {
    throw new NotFoundError("Attachment not found.");
  }

  return attachment;
}

function validateAttachmentMimeType(mimeType: string): void {
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    throw new ValidationError("Unsupported attachment file type.");
  }
}

// Physical storage layout:
//
// workspaces/{workspaceId}/tasks/{taskId}/
function buildAttachmentDirectory(workspaceId: string, taskId: string): string {
  return `workspaces/${workspaceId}/tasks/${taskId}`;
}

function toAttachmentResponse(
  attachment: AttachmentWithUploader,
): AttachmentResponse {
  return {
    id: attachment.id,

    originalName: attachment.originalName,

    mimeType: attachment.mimeType,

    size: attachment.size,

    uploader: {
      id: attachment.uploadedBy.id,
      name: attachment.uploadedBy.name,
      image: attachment.uploadedBy.image,
    },

    createdAt: attachment.createdAt,
  };
}

export async function uploadAttachment(
  actorId: string,
  taskId: string,
  file: Express.Multer.File,
): Promise<AttachmentResponse> {
  const task = await findTaskById(taskId);

  const membership = await getWorkspaceMembership(task.workspaceId, actorId);

  if (membership.role === WorkspaceRole.GUEST) {
    throw new ForbiddenError("Guests cannot upload attachments.");
  }

  validateAttachmentMimeType(file.mimetype);

  const { buffer, originalname, mimetype, size } = file;

  const directory = buildAttachmentDirectory(task.workspaceId, task.id);

  const storageObject = await storageService.upload({
    content: buffer,
    directory,
    originalFileName: originalname,
    mimeType: mimetype,
    size,
  });

  try {
    const attachment = await prisma.attachment.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        uploadedById: actorId,

        originalName: originalname,

        storageKey: storageObject.storageKey,
        storageFileName: storageObject.storageFileName,

        mimeType: storageObject.mimeType,
        size: storageObject.size,
      },

      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // TODO:
    // Wrap attachment deletion and activity creation in a single
    // Prisma transaction once Activity Service supports
    // transactional writes.
    await createActivity({
      workspaceId: task.workspaceId,
      actorId,

      type: ActivityType.ATTACHMENT_UPLOADED,

      entityType: ActivityEntityType.ATTACHMENT,
      entityId: attachment.id,

      metadata: {
        attachmentName: attachment.originalName,
        taskTitle: task.title,
      },
    });

    return toAttachmentResponse(attachment);
  } catch (error) {
    try {
      await storageService.delete(storageObject.storageKey);
    } catch {
      // Best-effort cleanup.
      // Preserve the original database error if cleanup fails.
    }

    throw error;
  }
}

export async function listTaskAttachments(
  actorId: string,
  taskId: string,
): Promise<AttachmentResponse[]> {
  const task = await findTaskById(taskId);

  await getWorkspaceMembership(task.workspaceId, actorId);

  const attachments = await prisma.attachment.findMany({
    where: {
      taskId: task.id,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return attachments.map(toAttachmentResponse);
}

export async function downloadAttachment(
  actorId: string,
  attachmentId: string,
): Promise<DownloadAttachmentResponse> {
  const attachment = await findAttachmentById(attachmentId);

  await getWorkspaceMembership(attachment.task.workspaceId, actorId);

  const file = await storageService.stream(attachment.storageKey);

  return {
    stream: file.stream,
    mimeType: attachment.mimeType,
    originalName: attachment.originalName,
    size: attachment.size,
  };
}

export async function deleteAttachment(
  actorId: string,
  attachmentId: string,
): Promise<void> {
  const attachment = await findAttachmentById(attachmentId);

  const membership = await getWorkspaceMembership(
    attachment.task.workspaceId,
    actorId,
  );

  if (membership.role === WorkspaceRole.GUEST) {
    throw new ForbiddenError("Guests cannot delete attachments.");
  }

  await storageService.delete(attachment.storageKey);

  await prisma.attachment.delete({
    where: {
      id: attachment.id,
    },
  });

  await createActivity({
    workspaceId: attachment.task.workspaceId,
    actorId,

    type: ActivityType.ATTACHMENT_DELETED,

    entityType: ActivityEntityType.ATTACHMENT,
    entityId: attachment.id,

    metadata: {
      attachmentName: attachment.originalName,
      taskTitle: attachment.task.title,
    },
  });
}
