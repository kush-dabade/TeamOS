import { z } from "zod";

export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Project name must be at least 3 characters.")
    .max(100, "Project name must be 100 characters or fewer."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer."),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
