import { z } from "zod";

export const sprintTaskParamsSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  taskId: z.string().min(1, "Task ID is required"),
});

export const sprintTasksListParamsSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
});

export type SprintTaskParamsInput = z.infer<typeof sprintTaskParamsSchema>;

export type SprintTasksListParamsInput = z.infer<
  typeof sprintTasksListParamsSchema
>;
