import type { Request, Response } from "express";

import { sprintTaskParamsSchema } from "./sprint-task.validation.js";
import { sprintTasksListParamsSchema } from "./sprint-task.validation.js";

import {
  assignTaskToSprint,
  removeTaskFromSprint,
  listSprintTasks,
} from "./sprint-task.service.js";

export async function assignTaskToSprintHandler(req: Request, res: Response) {
  const params = sprintTaskParamsSchema.parse(req.params);

  const task = await assignTaskToSprint(
    req.user!.id,
    params.sprintId,
    params.taskId,
  );

  return res.status(200).json({
    success: true,
    data: task,
  });
}

export async function removeTaskFromSprintHandler(req: Request, res: Response) {
  const params = sprintTaskParamsSchema.parse(req.params);

  const task = await removeTaskFromSprint(
    req.user!.id,
    params.sprintId,
    params.taskId,
  );

  return res.status(200).json({
    success: true,
    data: task,
  });
}

export async function listSprintTasksHandler(req: Request, res: Response) {
  const params = sprintTasksListParamsSchema.parse(req.params);

  const tasks = await listSprintTasks(req.user!.id, params.sprintId);

  return res.status(200).json({
    success: true,
    data: tasks,
  });
}
