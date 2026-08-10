import type { Request, Response } from "express";

import { searchQuerySchema } from "./search.schema.js";
import { search } from "./search.service.js";

export async function searchHandler(req: Request, res: Response) {
  const query = searchQuerySchema.parse(req.query);

  const result = await search(req.user!.id, query);

  return res.status(200).json({
    success: true,
    data: result,
  });
}
