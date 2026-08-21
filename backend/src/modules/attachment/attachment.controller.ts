import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";

import {
  uploadAttachment,
  downloadAttachment,
  listTaskAttachments,
  deleteAttachment,
} from "./attachment.service.js";

import { logger } from "../../lib/logger.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { buildAttachmentContentDisposition } from "../../shared/http/content-disposition.js";

export async function uploadAttachmentHandler(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    throw new ValidationError("Attachment file is required.");
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
    buildAttachmentContentDisposition(attachment.originalName),
  );

  res.setHeader("Content-Length", attachment.size.toString());

  try {
    // pipeline() (unlike a bare .pipe()) guarantees the source stream is
    // destroyed when the destination closes early — e.g. the client
    // disconnects mid-download — not just when the source itself errors.
    await pipeline(attachment.stream, res);
  } catch (error) {
    logger.error({ err: error }, "Attachment stream error");

    // pipeline() always destroys the destination on failure — including
    // when the source errors before any bytes were written, well before
    // headersSent would be true. Attempting a JSON response on an
    // already-destroyed res is a no-op write into a torn-down connection,
    // so both conditions must be checked, not headersSent alone.
    if (!res.headersSent && !res.destroyed) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to stream attachment.",
        },
      });
    }
  }
}

export async function deleteAttachmentHandler(req: Request, res: Response) {
  await deleteAttachment(req.user!.id, req.params.attachmentId as string);

  return res.status(204).send();
}
