import { z } from "zod";

import { ActivityEntityType } from "../../generated/prisma/enums.js";

export const listActivitiesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().positive().max(100).default(20),

    entityType: z.nativeEnum(ActivityEntityType).optional(),

    entityId: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasEntityType = data.entityType !== undefined;
      const hasEntityId = data.entityId !== undefined;

      return hasEntityType === hasEntityId;
    },
    {
      message: "entityType and entityId must be provided together",
      path: ["entityType"],
    },
  );
