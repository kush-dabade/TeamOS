import { z } from "zod";

export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required.")
    .max(100, "Project name must be 100 characters or fewer."),
  description: z.string().trim(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
