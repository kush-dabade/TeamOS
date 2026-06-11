import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  createCommentHandler,
  listCommentsHandler,
} from "./comments.controller.js";

const router = Router();

router.post(
  "/:taskId/comments",
  requireAuth,
  createCommentHandler,
);

router.get(
  "/:taskId/comments",
  requireAuth,
  listCommentsHandler,
);

export default router;
