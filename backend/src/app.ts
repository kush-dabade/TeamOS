import express from "express";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
import projectRoutes from "./modules/project/project.routes.js";
import taskRoutes from "./modules/task/task.routes.js";
import commentRoutes from "./modules/comments/comments.routes.js";
import activityRoutes from "./modules/activity/activity.routes.js";
import taskItemRoutes from "./modules/task/task-item.routes.js";
import projectItemRoutes from "./modules/project/project-item.routes.js";
import sprintRoutes from "./modules/sprint/sprint.routes.js";
import sprintItemRoutes from "./modules/sprint/sprint-item.routes.js";
import sprintTaskRoutes from "./modules/sprint-task/sprint-task.routes.js";

const app = express();

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// workspace resources
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/workspaces", projectRoutes);
app.use("/api/v1/workspaces", activityRoutes);

// project resources
app.use("/api/v1/projects", taskRoutes);
app.use("/api/v1/projects", sprintRoutes);

// item resources
app.use("/api/v1/projects", projectItemRoutes);
app.use("/api/v1/tasks", taskItemRoutes);
app.use("/api/v1/tasks", commentRoutes);
app.use("/api/v1/sprints", sprintItemRoutes);
app.use("/api/v1/sprints", sprintTaskRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TeamOS API is running",
  });
});

export default app;
