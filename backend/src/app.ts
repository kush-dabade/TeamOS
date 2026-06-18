import express from "express";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
import projectRoutes from "./modules/project/project.routes.js";
import taskRoutes from "./modules/task/task.routes.js";
import commentRoutes from "./modules/comments/comments.routes.js";
import activityRoutes from "./modules/activity/activity.routes.js";
import taskItemRoutes from "./modules/task/task-item.routes.js";

const app = express();

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/workspaces", projectRoutes);
app.use("/api/v1/workspaces", activityRoutes);

app.use("/api/v1/projects", taskRoutes);
app.use("/api/v1/tasks", taskItemRoutes);
app.use("/api/v1/tasks", commentRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TeamOS API is running",
  });
});

export default app;
