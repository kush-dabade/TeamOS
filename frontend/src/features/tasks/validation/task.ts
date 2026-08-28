import { z } from "zod";

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Task title must be at least 3 characters.")
    .max(255, "Task title must be 255 characters or fewer."),
  projectId: z.string().min(1, "Project is required."),
  description: z.string().trim().max(5000, "Description must be 5000 characters or fewer."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  assigneeId: z.string(),
  dueDate: z.union([z.iso.date(), z.literal("")]),
});

export type TaskFormData = z.infer<typeof taskSchema>;
