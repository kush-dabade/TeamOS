import type { Request, Response } from "express";

import { createWorkspaceSchema } from "./workspace.schema.js";
import {
  createWorkspace,
  getUserWorkspaces,
} from "./workspace.service.js";

export async function createWorkspaceHandler(
  req: Request,
  res: Response
) {
  try {
    const body = createWorkspaceSchema.parse(req.body);

    const workspace = await createWorkspace({
      name: body.name,
      ownerId: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Invalid request",
      },
    });
  }
}

export async function getUserWorkspacesHandler(
  req: Request,
  res: Response
) {
  const workspaces = await getUserWorkspaces(
    req.user!.id
  );

  return res.status(200).json({
    success: true,
    data: workspaces,
  });
}