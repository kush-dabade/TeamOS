import type { Request, Response } from "express";

import {
  uploadAttachment,
  downloadAttachment,
  listTaskAttachments,
  deleteAttachment,
} from "./attachment.service.js";

export async function uploadAttachmentHandler(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Attachment file is required.",
      },
    });
  }

  const attachment = await uploadAttachment(
    req.user!.id,
    req.params.taskId as string,
    file,
  );

  return res.status(201).json({
    success: true,
    data: {
      attachment,
    },
  });
}

export async function listTaskAttachmentsHandler(req: Request, res: Response) {
  const attachments = await listTaskAttachments(
    req.user!.id,
    req.params.taskId as string,
  );

  return res.status(200).json({
    success: true,
    data: {
      attachments,
    },
  });
}

export async function downloadAttachmentHandler(req: Request, res: Response) {
  const attachment = await downloadAttachment(
    req.user!.id,
    req.params.attachmentId as string,
  );

  res.setHeader("Content-Type", attachment.mimeType);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${attachment.originalName}"`,
  );

  res.setHeader("Content-Length", attachment.size.toString());

  attachment.stream.on("error", (error) => {
    console.error("Attachment stream error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to stream attachment.",
        },
      });
    } else {
      res.destroy(error);
    }
  });

  attachment.stream.pipe(res);
}

export async function deleteAttachmentHandler(req: Request, res: Response) {
  await deleteAttachment(req.user!.id, req.params.attachmentId as string);

  return res.status(204).send();
}
