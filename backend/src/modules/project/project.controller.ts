import type { Request, Response } from "express";
import { ZodError } from "zod";

import { createProjectSchema } from "./project.schema.js";
import { createProject } from "./project.service.js";

import { listProjectsQuerySchema } from "./project.schema.js";
import { listProjects } from "./project.service.js";

export async function createProjectHandler(req: Request, res: Response) {
  try {
    const body = createProjectSchema.parse(req.body);

    const project = await createProject(req.user!.id, {
      workspaceId: req.params.workspaceId as string,
      ownerId: body.ownerId,
      name: body.name,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request",
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes("Only workspace owners and admins")
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes("You are not a member of this workspace")
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes("Project owner must be a workspace member")
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: error.message,
        },
      });
    }

    console.error("Project creation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listProjectsHandler(req: Request, res: Response) {
  try {
    const query = listProjectsQuerySchema.parse(req.query);

    const projects = await listProjects(req.user!.id, {
      workspaceId: req.params.workspaceId as string,
      status: query.status,
    });

    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request",
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes("You are not a member of this workspace")
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    console.error("List projects error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
