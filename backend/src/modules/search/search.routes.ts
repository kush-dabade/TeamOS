import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { searchLimiter } from "../../middleware/rate-limit.js";

import { searchHandler } from "./search.controller.js";

const router = Router();

router.get("/", requireAuth, searchLimiter, searchHandler);

export default router;
