import type { Request, Response } from "express";
import { ZodError } from "zod";

import { createCommentSchema, updateCommentSchema } from "./comments.validation.js";

import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./comments.service.js";

export async function createCommentHandler(req: Request, res: Response) {
  try {
    const body = createCommentSchema.parse(req.body);

    const comment = await createComment(req.user!.id, {
      taskId: req.params.taskId as string,
      content: body.content,
    });

    return res.status(201).json({
      success: true,
      data: {
        comment,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request",
        },
      });
    }

    if (error instanceof Error && error.message.includes("Task not found")) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TASK_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      (error.message.includes("You are not a member of this workspace") ||
        error.message.includes("Guests cannot create comments"))
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message === "Archived projects cannot be modified"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Comment creation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listCommentsHandler(req: Request, res: Response) {
  try {
    const comments = await listComments(req.user!.id, {
      taskId: req.params.taskId as string,
    });

    return res.status(200).json({
      success: true,
      data: {
        comments,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request",
        },
      });
    }

    if (error instanceof Error && error.message.includes("Task not found")) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TASK_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes("You are not a member of this workspace")
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    console.error("List comments error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function updateCommentHandler(req: Request, res: Response) {
  try {
    const body = updateCommentSchema.parse(req.body);

    const comment = await updateComment(req.user!.id, {
      commentId: req.params.commentId as string,
      content: body.content,
    });

    return res.status(200).json({
      success: true,
      data: {
        comment,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request",
        },
      });
    }

    if (error instanceof Error && error.message.includes("Comment not found")) {
      return res.status(404).json({
        success: false,
        error: {
          code: "COMMENT_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      (error.message.includes("You are not a member of this workspace") ||
        error.message.includes("Guests cannot edit comments") ||
        error.message.includes("You can only edit your own comments"))
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message === "Archived projects cannot be modified"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Comment update error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function deleteCommentHandler(req: Request, res: Response) {
  try {
    await deleteComment(req.user!.id, {
      commentId: req.params.commentId as string,
    });

    return res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Comment not found")) {
      return res.status(404).json({
        success: false,
        error: {
          code: "COMMENT_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      (error.message.includes("You are not a member of this workspace") ||
        error.message.includes("Guests cannot delete comments") ||
        error.message.includes(
          "You do not have permission to delete this comment",
        ))
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message === "Archived projects cannot be modified"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Comment delete error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
