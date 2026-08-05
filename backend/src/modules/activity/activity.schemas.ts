import { z } from "zod";

import { ActivityEntityType } from "../../generated/prisma/enums.js";

export const listActivitiesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().positive().max(100).default(20),

    entityType: z.nativeEnum(ActivityEntityType).optional(),

    entityId: z.string().min(1).optional(),

    taskId: z.string().min(1).optional(),

    projectId: z.string().min(1).optional(),
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
  )
  .refine(
    (data) => {
      const hasEntityPair = data.entityType !== undefined && data.entityId !== undefined;
      const hasTaskId = data.taskId !== undefined;
      const hasProjectId = data.projectId !== undefined;

      const activeFilterCount = [hasEntityPair, hasTaskId, hasProjectId].filter(
        Boolean,
      ).length;

      return activeFilterCount <= 1;
    },
    {
      message:
        "Only one of entityType/entityId, taskId, or projectId may be provided",
      path: ["taskId"],
    },
  );
