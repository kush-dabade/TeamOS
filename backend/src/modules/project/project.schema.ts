import { z } from "zod";

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Project name must be at least 3 characters")
      .max(100, "Project name must be at most 100 characters"),

    description: z
      .string()
      .trim()
      .max(2000, "Description must be at most 2000 characters")
      .optional(),

    ownerId: z
      .string()
      .trim()
      .min(1, "Owner ID is required"),

    startDate: z.iso.date().optional(),

    endDate: z.iso.date().optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) {
        return true;
      }

      return (
        new Date(data.endDate) >=
        new Date(data.startDate)
      );
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  );

export const listProjectsQuerySchema = z.object({
  status: z
    .enum([
      "PLANNED",
      "ACTIVE",
      "COMPLETED",
      "ARCHIVED",
    ])
    .optional(),
});

export type CreateProjectInput = z.infer<
  typeof createProjectSchema
>;

export type ListProjectsQueryInput = z.infer<
  typeof listProjectsQuerySchema
>;