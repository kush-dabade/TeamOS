import { z } from "zod";
import { ProjectStatus } from "../../generated/prisma/enums.js";

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

    ownerId: z.string().trim().min(1, "Owner ID is required"),

    startDate: z.iso.date().optional(),

    endDate: z.iso.date().optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) {
        return true;
      }

      return new Date(data.endDate) >= new Date(data.startDate);
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Project name must be at least 3 characters")
      .max(100, "Project name must be at most 100 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(2000, "Description must be at most 2000 characters")
      .nullable()
      .optional(),

    status: z
      .enum([
        ProjectStatus.PLANNED,
        ProjectStatus.ACTIVE,
        ProjectStatus.COMPLETED,
      ])
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

export const listProjectsQuerySchema = z.object({
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

export const transferProjectOwnershipSchema = z.object({
  newOwnerId: z.string().trim().min(1, "New owner ID is required"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export type ListProjectsQueryInput = z.infer<typeof listProjectsQuerySchema>;

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export type TransferProjectOwnershipInput = z.infer<
  typeof transferProjectOwnershipSchema
>;
