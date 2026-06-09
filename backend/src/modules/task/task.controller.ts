import type { Request, Response } from "express";
import { ZodError } from "zod";

import { createTaskSchema, listTasksQuerySchema } from "./task.schema.js";

import { createTask, listTasks } from "./task.service.js";

export async function createTaskHandler(req: Request, res: Response) {
  try {
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
      (error.message.includes("You are not a member of this workspace") ||
        error.message.includes("Guests cannot create tasks"))
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
      (error.message.includes("Project not found") ||
        error.message.includes("Assignee must be a workspace member"))
    ) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: error.message,
        },
      });
    }

    console.error("Task creation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listTasksHandler(req: Request, res: Response) {
  try {
    listTasksQuerySchema.parse(req.query);

    const tasks = await listTasks(req.user!.id, {
      projectId: req.params.projectId as string,
    });

    return res.status(200).json({
      success: true,
      data: tasks,
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

    if (error instanceof Error && error.message.includes("Project not found")) {
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

    console.error("List tasks error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
