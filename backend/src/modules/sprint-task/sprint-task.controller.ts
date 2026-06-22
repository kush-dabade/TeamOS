import type { Request, Response } from "express";
import { ZodError } from "zod";

import { sprintTaskParamsSchema } from "./sprint-task.validation.js";
import { sprintTasksListParamsSchema } from "./sprint-task.validation.js";

import {
  assignTaskToSprint,
  removeTaskFromSprint,
  listSprintTasks,
} from "./sprint-task.service.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

export async function assignTaskToSprintHandler(req: Request, res: Response) {
  try {
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
          code: "RESOURCE_NOT_FOUND",
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

    console.error("Assign task to sprint error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function removeTaskFromSprintHandler(req: Request, res: Response) {
  try {
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
          code: "RESOURCE_NOT_FOUND",
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

    console.error("Remove task from sprint error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listSprintTasksHandler(req: Request, res: Response) {
  try {
    const params = sprintTasksListParamsSchema.parse(req.params);

    const tasks = await listSprintTasks(req.user!.id, params.sprintId);

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
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SPRINT_NOT_FOUND",
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

    console.error("List sprint tasks error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
