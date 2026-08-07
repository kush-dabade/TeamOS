import { z } from "zod";

export const sprintSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Sprint name must be at least 3 characters.")
      .max(100, "Sprint name must be 100 characters or fewer."),
    goal: z.string().trim().max(500, "Goal must be 500 characters or fewer."),
    startDate: z.union([z.iso.date(), z.literal("")]),
    endDate: z.union([z.iso.date(), z.literal("")]),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

export type SprintFormData = z.infer<typeof sprintSchema>;
