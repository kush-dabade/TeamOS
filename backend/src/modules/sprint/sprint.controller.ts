import type { Request, Response } from "express";
import { ZodError } from "zod";

import { createSprintSchema, updateSprintSchema } from "./sprint.schema.js";
import {
  createSprint,
  listSprints,
  getSprint,
  updateSprint,
} from "./sprint.service.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

export async function createSprintHandler(req: Request, res: Response) {
  try {
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
          code: "PROJECT_NOT_FOUND",
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

    console.error("Sprint creation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listSprintsHandler(req: Request, res: Response) {
  try {
    const sprints = await listSprints(
      req.user!.id,
      req.params.projectId as string,
    );

    return res.status(200).json({
      success: true,
      data: sprints,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
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

    console.error("List sprints error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function getSprintHandler(req: Request, res: Response) {
  try {
    const sprint = await getSprint(req.user!.id, req.params.sprintId as string);

    return res.status(200).json({
      success: true,
      data: sprint,
    });
  } catch (error) {
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

    console.error("Get sprint error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function updateSprintHandler(req: Request, res: Response) {
  try {
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

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Update sprint error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
