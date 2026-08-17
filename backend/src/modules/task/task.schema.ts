import { z } from "zod";

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Task title must be at least 3 characters")
    .max(255, "Task title must be at most 255 characters"),

  description: z
    .string()
    .trim()
    .max(5000, "Description must be at most 5000 characters")
    .optional(),

  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),

  dueDate: z.iso.date().optional(),

  assigneeId: z.string().trim().min(1, "Assignee ID is required").optional(),
});

export const listTasksQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Task title must be at least 3 characters")
      .max(255, "Task title must be at most 255 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(5000, "Description must be at most 5000 characters")
      .nullable()
      .optional(),

    status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),

    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),

    dueDate: z.iso.date().nullable().optional(),

    assigneeId: z
      .string()
      .trim()
      .min(1, "Assignee ID is required")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
    path: ["body"],
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type ListTasksQueryInput = z.infer<typeof listTasksQuerySchema>;

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
