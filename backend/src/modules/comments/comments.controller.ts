import type { Request, Response } from "express";

import { createCommentSchema, updateCommentSchema } from "./comments.validation.js";

import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./comments.service.js";

export async function createCommentHandler(req: Request, res: Response) {
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
}

export async function listCommentsHandler(req: Request, res: Response) {
  const comments = await listComments(req.user!.id, {
    taskId: req.params.taskId as string,
  });

  return res.status(200).json({
    success: true,
    data: {
      comments,
    },
  });
}

export async function updateCommentHandler(req: Request, res: Response) {
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
}

export async function deleteCommentHandler(req: Request, res: Response) {
  await deleteComment(req.user!.id, {
    commentId: req.params.commentId as string,
  });

  return res.status(204).send();
}
