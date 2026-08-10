import type { Request, Response } from "express";

import { listActivitiesQuerySchema } from "./activity.schemas.js";

import { listWorkspaceActivities } from "./activity.service.js";

export async function listWorkspaceActivitiesHandler(
  req: Request,
  res: Response,
) {
  const query = listActivitiesQuerySchema.parse(req.query);

  const result = await listWorkspaceActivities(req.user!.id, {
    workspaceId: req.params.workspaceId as string,

    page: query.page,
    limit: query.limit,

    ...(query.entityType !== undefined && { entityType: query.entityType }),
    ...(query.entityId !== undefined && { entityId: query.entityId }),

    ...(query.taskId !== undefined && { taskId: query.taskId }),
    ...(query.projectId !== undefined && { projectId: query.projectId }),
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
}
