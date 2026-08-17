import type { Request, Response } from "express";

import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "./task.schema.js";

import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
} from "./task.service.js";

export async function createTaskHandler(req: Request, res: Response) {
  const body = createTaskSchema.parse(req.body);

  const task = await createTask(req.user!.id, {
    projectId: req.params.projectId as string,
    title: body.title,
    description: body.description,

    priority: body.priority,

    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,

    assigneeId: body.assigneeId,
  });

  return res.status(201).json({
    success: true,
    data: task,
  });
}

export async function listTasksHandler(req: Request, res: Response) {
  const query = listTasksQuerySchema.parse(req.query);

  const result = await listTasks(req.user!.id, {
    projectId: req.params.projectId as string,

    page: query.page,
    limit: query.limit,
  });

  return res.status(200).json({
    success: true,
    data: {
      tasks: result.tasks,
    },
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      pages: Math.ceil(result.total / query.limit),
    },
  });
}

export async function getTaskByIdHandler(req: Request, res: Response) {
  const task = await getTaskById(req.user!.id, req.params.taskId as string);

  return res.status(200).json({
    success: true,
    data: task,
  });
}

export async function deleteTaskHandler(req: Request, res: Response) {
  await deleteTask(req.user!.id, req.params.taskId as string);

  return res.status(200).json({
    success: true,
    data: null,
  });
}

export async function updateTaskHandler(req: Request, res: Response) {
  const body = updateTaskSchema.parse(req.body);

  const updateData = {
    ...(body.title !== undefined && {
      title: body.title,
    }),

    ...(body.description !== undefined && {
      description: body.description,
    }),

    ...(body.status !== undefined && {
      status: body.status,
    }),

    ...(body.priority !== undefined && {
      priority: body.priority,
    }),

    ...(body.assigneeId !== undefined && {
      assigneeId: body.assigneeId,
    }),

    ...(body.dueDate !== undefined && {
      dueDate: body.dueDate === null ? null : new Date(body.dueDate),
    }),
  };

  const task = await updateTask(
    req.user!.id,
    req.params.taskId as string,
    updateData,
  );

  return res.status(200).json({
    success: true,
    data: task,
  });
}
