import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth.js";
import { trustedOrigins, trustProxyHops } from "./config/security.config.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
import workspaceItemRoutes from "./modules/workspace/workspace-item.routes.js";
import projectRoutes from "./modules/project/project.routes.js";
import taskRoutes from "./modules/task/task.routes.js";
import commentRoutes from "./modules/comments/comments.routes.js";
import activityRoutes from "./modules/activity/activity.routes.js";
import taskItemRoutes from "./modules/task/task-item.routes.js";
import projectItemRoutes from "./modules/project/project-item.routes.js";
import sprintRoutes from "./modules/sprint/sprint.routes.js";
import sprintItemRoutes from "./modules/sprint/sprint-item.routes.js";
import sprintTaskRoutes from "./modules/sprint-task/sprint-task.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import invitationRoutes from "./modules/invitation/invitation.routes.js";
import taskAttachmentRoutes from "./modules/task/task-attachment.routes.js";
import workspaceInvitationRoutes from "./modules/invitation/workspace-invitation.routes.js";
import attachmentItemRoutes from "./modules/attachment/attachment-item.routes.js";
import commentItemRoutes from "./modules/comments/comments-item.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { generalApiLimiter, verificationEmailLimiter } from "./middleware/rate-limit.js";
import { securityHeaders } from "./middleware/security-headers.js";

const app = express();

// Mounted first, ahead of CORS/auth/body-parsing/rate limiting/routes -
// res.setHeader calls persist on the response regardless of what happens
// afterward, including an error jumping straight to errorHandler past all
// remaining non-error middleware. Mounting this before everything else is
// what makes these headers show up on every response this app sends,
// success or error (404, 401/403, 429, 500 included), without needing to
// special-case any individual error path.
app.use(securityHeaders);

// FRONTEND_URL is not consumed here - it is validated for the API process
// specifically because this is currently the only startup-time guard for it
// in this process (modules/email/email.config.ts's copy of this check only
// loads in the worker process). CORS itself is driven by TRUSTED_ORIGINS via
// config/security.config.ts, the same source of truth Better Auth and
// Socket.IO use.
const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL environment variable is required.");
}

app.set("trust proxy", trustProxyHops);

app.use(
  cors({
    origin: trustedOrigins,
    credentials: true,
  }),
);

// Mounted ahead of the Better Auth catch-all below, scoped to this one
// path only. Better Auth's own built-in limiter is silently a no-op for
// all of /api/auth/* in this deployment (see verificationEmailLimiter's
// comment in middleware/rate-limit.ts for the confirmed reason), so this
// specific endpoint - session-less and email-sending, the highest-risk
// path under /api/auth/* - gets real, distributed-safe protection instead
// of relying on a check that never fires. Sign-in/sign-up/etc. are left
// alone: no evidence they're currently being abused, and duplicating
// Express-level limiting across all of /api/auth/* would be a larger
// rate-limiting refactor than this endpoint's real, reproduced gap calls for.
app.post("/api/auth/send-verification-email", verificationEmailLimiter);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Scoped to /api/v1 specifically (not a global app.use) so it never touches
// /api/auth/* or /health below.
app.use("/api/v1", generalApiLimiter);

// workspace resources
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/workspaces", workspaceItemRoutes);
app.use("/api/v1/workspaces", projectRoutes);
app.use("/api/v1/workspaces", activityRoutes);
app.use("/api/v1/workspaces", workspaceInvitationRoutes);

//search resources
app.use("/api/v1/search", searchRoutes);

// current-user resources
app.use("/api/v1/users", userRoutes);

// project resources
app.use("/api/v1/projects", taskRoutes);
app.use("/api/v1/projects", sprintRoutes);

// item resources
app.use("/api/v1/projects", projectItemRoutes);
app.use("/api/v1/tasks", taskItemRoutes);
app.use("/api/v1/tasks", commentRoutes);
app.use("/api/v1/tasks", taskAttachmentRoutes);
app.use("/api/v1/attachments", attachmentItemRoutes);
app.use("/api/v1/comments", commentItemRoutes);
app.use("/api/v1/sprints", sprintItemRoutes);
app.use("/api/v1/sprints", sprintTaskRoutes);

// invitation resources
app.use("/api/v1/invitations", invitationRoutes);

// notification resources
app.use("/api/v1/notifications", notificationRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TeamOS API is running",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
