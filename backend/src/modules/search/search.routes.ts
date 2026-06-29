import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

import { searchHandler } from "./search.controller.js";

const router = Router();

router.get("/", requireAuth, searchHandler);

export default router;
