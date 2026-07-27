import type { Request, Response } from "express";
import { ZodError } from "zod";

import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateWorkspaceMemberRoleSchema,
} from "./workspace.schema.js";
import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  updateWorkspace,
  listWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from "./workspace.service.js";
import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

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

export async function getWorkspaceHandler(req: Request, res: Response) {
  try {
    const workspace = await getWorkspace(
      req.params.workspaceId as string,
      req.user!.id,
    );

    return res.status(200).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: error.message,
        },
      });
    }

    console.error("Get workspace error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function updateWorkspaceHandler(req: Request, res: Response) {
  try {
    const body = updateWorkspaceSchema.parse(req.body);

    const workspace = await updateWorkspace(
      req.user!.id,
      req.params.workspaceId as string,
      body,
    );

    return res.status(200).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: error.message,
        },
      });
    }

    console.error("Update workspace error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listWorkspaceMembersHandler(req: Request, res: Response) {
  try {
    const members = await listWorkspaceMembers(
      req.params.workspaceId as string,
      req.user!.id,
    );

    return res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MEMBER_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    console.error("List workspace members error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function updateWorkspaceMemberRoleHandler(
  req: Request,
  res: Response,
) {
  try {
    const body = updateWorkspaceMemberRoleSchema.parse(req.body);

    const member = await updateWorkspaceMemberRole(
      req.user!.id,
      req.params.workspaceId as string,
      req.params.memberId as string,
      body.role,
    );

    return res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MEMBER_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Update workspace member role error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function removeWorkspaceMemberHandler(
  req: Request,
  res: Response,
) {
  try {
    const result = await removeWorkspaceMember(
      req.user!.id,
      req.params.workspaceId as string,
      req.params.memberId as string,
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MEMBER_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Remove workspace member error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}