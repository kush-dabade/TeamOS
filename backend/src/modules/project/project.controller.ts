import type { Request, Response } from "express";
import { ZodError } from "zod";

import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from "./project.schema.js";

import {
  archiveProject,
  createProject,
  listProjects,
  getProject,
  updateProject,
} from "./project.service.js";

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

export async function getProjectHandler(req: Request, res: Response) {
  try {
    const project = await getProject(
      req.user!.id,
      req.params.projectId as string,
    );

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found") {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
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

    console.error("Get project error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function updateProjectHandler(req: Request, res: Response) {
  try {
    const body = updateProjectSchema.parse(req.body);

    const project = await updateProject(
      req.user!.id,
      req.params.projectId as string,
      body,
    );

    return res.status(200).json({
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

    if (error instanceof Error && error.message === "Project not found") {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes(
        "Only workspace owners and admins can update projects",
      )
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
      error.message === "Archived projects cannot be updated"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Update project error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function archiveProjectHandler(req: Request, res: Response) {
  try {
    const project = await archiveProject(
      req.user!.id,
      req.params.projectId as string,
    );

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found") {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (
      error instanceof Error &&
      error.message.includes(
        "Only workspace owners and admins can archive projects",
      )
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
      error.message === "Project is already archived"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Archive project error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
