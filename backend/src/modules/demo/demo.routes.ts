import { Router } from "express";

import { demoSessionLimiter } from "../../middleware/rate-limit.js";

import { createDemoSessionHandler } from "./demo.controller.js";

const router = Router();

// Deliberately no requireAuth - the entire point is to let an anonymous
// visitor in. demoSessionLimiter is the first middleware, ahead of the
// controller, so a rate-limited request never reaches the expensive
// provisioning work in demo.service.ts.
router.post("/session", demoSessionLimiter, createDemoSessionHandler);

export default router;
