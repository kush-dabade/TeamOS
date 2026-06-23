import type { Request, Response } from "express";
import { ZodError } from "zod";

import { createWorkspaceSchema } from "./workspace.schema.js";
import { createWorkspace, getUserWorkspaces } from "./workspace.service.js";

export async function createWorkspaceHandler(req: Request, res: Response) {
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
    // Handle validation errors from Zod
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request",
        },
      });
    }

    // Handle unique constraint violations (duplicate slug, etc.)
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        error.message.includes("duplicate key") ||
        (error as any).code === "P2002" ||
        (error as any).code === "ER_DUP_ENTRY")
    ) {
      return res.status(409).json({
        success: false,
        error: {
          code: "CONFLICT",
          message: "Resource already exists",
        },
      });
    }

    // Log unexpected errors
    console.error("Workspace creation error:", error);

    // Handle all other internal errors
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function getUserWorkspacesHandler(req: Request, res: Response) {
  const workspaces = await getUserWorkspaces(req.user!.id);

  return res.status(200).json({
    success: true,
    data: workspaces,
  });
}
