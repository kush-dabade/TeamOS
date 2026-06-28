import type { Request, Response } from "express";

import {
  uploadAttachment,
  downloadAttachment,
  listTaskAttachments,
  deleteAttachment,
} from "./attachment.service.js";

export async function uploadAttachmentHandler(req: Request, res: Response) {
  try {
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Task not found")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "TASK_NOT_FOUND",
            message: error.message,
          },
        });
      }

      if (
        error.message.includes("You are not a member of this workspace") ||
        error.message.includes("Guests cannot upload attachments")
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: error.message,
          },
        });
      }

      if (error.message.includes("Unsupported attachment file type")) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
          },
        });
      }
    }

    console.error("Attachment upload error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listTaskAttachmentsHandler(req: Request, res: Response) {
  try {
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Task not found")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "TASK_NOT_FOUND",
            message: error.message,
          },
        });
      }

      if (error.message.includes("You are not a member of this workspace")) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: error.message,
          },
        });
      }
    }

    console.error("List attachments error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function downloadAttachmentHandler(req: Request, res: Response) {
  try {
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Attachment not found")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ATTACHMENT_NOT_FOUND",
            message: error.message,
          },
        });
      }

      if (error.message.includes("You are not a member of this workspace")) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: error.message,
          },
        });
      }
    }

    console.error("Attachment download error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function deleteAttachmentHandler(req: Request, res: Response) {
  try {
    await deleteAttachment(req.user!.id, req.params.attachmentId as string);

    return res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Attachment not found")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ATTACHMENT_NOT_FOUND",
            message: error.message,
          },
        });
      }

      if (
        error.message.includes("You are not a member of this workspace") ||
        error.message.includes("Guests cannot delete attachments")
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: error.message,
          },
        });
      }
    }

    console.error("Attachment delete error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
