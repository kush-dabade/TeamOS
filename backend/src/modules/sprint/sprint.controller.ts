import type { Request, Response } from "express";

import { createSprintSchema, updateSprintSchema } from "./sprint.schema.js";
import {
  createSprint,
  listSprints,
  getSprint,
  updateSprint,
  startSprint,
  completeSprint,
} from "./sprint.service.js";

export async function createSprintHandler(req: Request, res: Response) {
  const body = createSprintSchema.parse(req.body);

  const sprint = await createSprint(req.user!.id, {
    projectId: req.params.projectId as string,

    name: body.name,
    goal: body.goal,

    startDate: body.startDate ? new Date(body.startDate) : undefined,

    endDate: body.endDate ? new Date(body.endDate) : undefined,
  });

  return res.status(201).json({
    success: true,
    data: sprint,
  });
}

export async function listSprintsHandler(req: Request, res: Response) {
  const sprints = await listSprints(
    req.user!.id,
    req.params.projectId as string,
  );

  return res.status(200).json({
    success: true,
    data: sprints,
  });
}

export async function getSprintHandler(req: Request, res: Response) {
  const sprint = await getSprint(req.user!.id, req.params.sprintId as string);

  return res.status(200).json({
    success: true,
    data: sprint,
  });
}

export async function updateSprintHandler(req: Request, res: Response) {
  const body = updateSprintSchema.parse(req.body);

  const sprint = await updateSprint(
    req.user!.id,
    req.params.sprintId as string,
    body,
  );

  return res.status(200).json({
    success: true,
    data: sprint,
  });
}

export async function startSprintHandler(req: Request, res: Response) {
  const sprint = await startSprint(
    req.user!.id,
    req.params.sprintId as string,
  );

  return res.status(200).json({
    success: true,
    data: sprint,
  });
}

export async function completeSprintHandler(req: Request, res: Response) {
  const sprint = await completeSprint(
    req.user!.id,
    req.params.sprintId as string,
  );

  return res.status(200).json({
    success: true,
    data: sprint,
  });
}
