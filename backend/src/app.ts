import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth.js";
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

const app = express();

const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL environment variable is required.");
}

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

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

export default app;
