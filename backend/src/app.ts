import express from "express";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./lib/auth.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";

const app = express();

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/v1/workspaces", workspaceRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TeamOS API is running",
  });
});

export default app;