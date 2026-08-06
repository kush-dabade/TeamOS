import type { Request, Response } from "express";
import { ZodError } from "zod";

import { searchQuerySchema } from "./search.schema.js";
import { search } from "./search.service.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";

export async function searchHandler(req: Request, res: Response) {
  try {
    const query = searchQuerySchema.parse(req.query);

    const result = await search(req.user!.id, query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid search query.",
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

    console.error("Search error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}
