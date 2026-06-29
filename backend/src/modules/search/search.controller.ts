import type { Request, Response } from "express";

import { searchQuerySchema } from "./search.schema.js";
import { search } from "./search.service.js";

export async function searchHandler(req: Request, res: Response) {
  try {
    const query = searchQuerySchema.parse(req.query);

    const result = await search(req.user!.id, query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid search query.",
          },
        });
      }
      if (error.message.includes("You are not a member of this workspace")) {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: error.message,
          },
        });
      }
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
