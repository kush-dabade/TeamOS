import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import {
  updateCommentHandler,
  deleteCommentHandler,
} from "./comments.controller.js";

const router = Router();

router.patch("/:commentId", requireAuth, updateCommentHandler);

router.delete("/:commentId", requireAuth, deleteCommentHandler);

export default router;
