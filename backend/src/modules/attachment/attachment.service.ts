import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { storageService, FileNotFoundError } from "../../storage/index.js";

import {
  ActivityEntityType,
  ActivityType,
  ProjectStatus,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { createActivity } from "../activity/activity.service.js";

import { ALLOWED_ATTACHMENT_MIME_TYPES, DEMO_ATTACHMENT_MAX_FILE_SIZE } from "./attachment.config.js";

import type {
  AttachmentResponse,
  DownloadAttachmentResponse,
  ListTaskAttachmentsOptions,
  ListTaskAttachmentsResult,
} from "./attachment.types.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { requireWorkspaceMembership } from "../../shared/authorization/workspace-access.js";

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
      projectId: true,
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
          deletedAt: true,
          projectId: true,
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

  if (!attachment || attachment.task.deletedAt) {
    throw new NotFoundError("Attachment not found.");
  }

  return attachment;
}

// Mirrors the archived-project mutation guard already duplicated in
// task.service.ts, comments.service.ts, and sprint.service.ts - kept local
// to this module rather than shared, since each of those call sites has its
// own project-lookup shape.
async function assertProjectNotArchived(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      status: true,
    },
  });

  if (project?.status === ProjectStatus.ARCHIVED) {
    throw new ValidationError("Archived projects cannot be modified");
  }
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

// Server-side only - isDemo is looked up fresh from the database by
// uploadAttachment below, never taken from anything the client sends.
// middleware/multer.ts's ATTACHMENT_MAX_FILE_SIZE (10MB) already ran ahead
// of this for every caller; this is an additional, tighter bound that only
// applies to demo accounts (modules/demo/, Commit 3), so an anonymous,
// free-to-create demo session can't be used as unrestricted file storage.
function validateDemoAttachmentSize(isDemo: boolean, size: number): void {
  if (isDemo && size > DEMO_ATTACHMENT_MAX_FILE_SIZE) {
    throw new ValidationError(
      `Demo workspaces are limited to attachments up to ${DEMO_ATTACHMENT_MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    );
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

  const membership = await requireWorkspaceMembership(task.workspaceId, actorId);

  if (membership.role === WorkspaceRole.GUEST) {
    throw new ForbiddenError("Guests cannot upload attachments.");
  }

  await assertProjectNotArchived(task.projectId);

  validateAttachmentMimeType(file.mimetype);

  const actor = await prisma.user.findUnique({
    where: {
      id: actorId,
    },
    select: {
      isDemo: true,
    },
  });

  if (!actor) {
    throw new NotFoundError("User not found");
  }

  validateDemoAttachmentSize(actor.isDemo, file.size);

  const { buffer, originalname, mimetype, size } = file;

  const directory = buildAttachmentDirectory(task.workspaceId, task.id);

  const storageObject = await storageService.upload({
    content: buffer,
    directory,
    originalFileName: originalname,
    mimeType: mimetype,
    size,
  });
  let attachment: AttachmentWithUploader | undefined;
  try {
    attachment = await prisma.attachment.create({
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

      taskId: task.id,
      projectId: task.projectId,

      metadata: {
        attachmentName: attachment.originalName,
        taskTitle: task.title,
      },
    });

    const response = toAttachmentResponse(attachment);

    emitToWorkspace(task.workspaceId, REALTIME_EVENTS.ATTACHMENT_UPLOADED, {
      workspaceId: task.workspaceId,
      taskId: task.id,
      attachment: response,
    });

    return response;
  } catch (error) {
    if (attachment) {
      try {
        await prisma.attachment.delete({
          where: {
            id: attachment.id,
          },
        });
      } catch {
        // Best-effort rollback.
      }
    }

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
  options: ListTaskAttachmentsOptions,
): Promise<ListTaskAttachmentsResult> {
  const task = await findTaskById(options.taskId);

  await requireWorkspaceMembership(task.workspaceId, actorId);

  const where = {
    taskId: task.id,
  };

  const skip = (options.page - 1) * options.limit;

  const [total, attachments] = await Promise.all([
    prisma.attachment.count({
      where,
    }),

    prisma.attachment.findMany({
      where,

      include: {
        uploadedBy: {
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
    attachments: attachments.map(toAttachmentResponse),
    total,
  };
}

export async function downloadAttachment(
  actorId: string,
  attachmentId: string,
): Promise<DownloadAttachmentResponse> {
  const attachment = await findAttachmentById(attachmentId);

  await requireWorkspaceMembership(attachment.task.workspaceId, actorId);

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

  const membership = await requireWorkspaceMembership(
    attachment.task.workspaceId,
    actorId,
  );

  if (membership.role === WorkspaceRole.GUEST) {
    throw new ForbiddenError("Guests cannot delete attachments.");
  }

  await assertProjectNotArchived(attachment.task.projectId);

  // PostgreSQL is authoritative here: the attachment row and its activity
  // record are deleted/created atomically first. Realtime emission and
  // storage cleanup only happen after that transaction has committed, so a
  // storage failure (including the file already being gone) can never
  // block or roll back the database deletion.
  let emitActivityCreated: () => void = () => {};

  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({
      where: {
        id: attachment.id,
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: attachment.task.workspaceId,
        actorId,

        type: ActivityType.ATTACHMENT_DELETED,

        entityType: ActivityEntityType.ATTACHMENT,
        entityId: attachment.id,

        taskId: attachment.task.id,
        projectId: attachment.task.projectId,

        metadata: {
          attachmentName: attachment.originalName,
          taskTitle: attachment.task.title,
        },
      },
      tx,
    );
  });

  emitActivityCreated();

  emitToWorkspace(
    attachment.task.workspaceId,
    REALTIME_EVENTS.ATTACHMENT_DELETED,
    {
      workspaceId: attachment.task.workspaceId,
      taskId: attachment.task.id,
      attachment: {
        id: attachment.id,
      },
    },
  );

  try {
    await storageService.delete(attachment.storageKey);
  } catch (error) {
    if (!(error instanceof FileNotFoundError)) {
      logger.error(
        { err: error, attachmentId: attachment.id, storageKey: attachment.storageKey },
        "Failed to delete attachment file",
      );
    }
    // Best-effort cleanup; the database record is already gone. A missing
    // physical file (FileNotFoundError) is not logged as a failure - it
    // means there is nothing left to clean up.
  }
}
