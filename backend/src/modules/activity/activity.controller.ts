import type { Request, Response } from "express";
import { ZodError } from "zod";

import { listActivitiesQuerySchema } from "./activity.schemas.js";

import { listWorkspaceActivities } from "./activity.service.js";
import { ForbiddenError } from "../../shared/errors/forbidden-error.js";

export async function listWorkspaceActivitiesHandler(
  req: Request,
  res: Response,
) {
  try {
    const query = listActivitiesQuerySchema.parse(req.query);

    const result = await listWorkspaceActivities(req.user!.id, {
      workspaceId: req.params.workspaceId as string,

      page: query.page,
      limit: query.limit,

      ...(query.entityType !== undefined && { entityType: query.entityType }),
      ...(query.entityId !== undefined && { entityId: query.entityId }),
    });

    return res.status(200).json({
      success: true,
      data: {
        activities: result.activities,
      },
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: Math.ceil(result.total / query.limit),
      },
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
    console.error("List activities error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
