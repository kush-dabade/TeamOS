import { z } from "zod";
import { SprintStatus } from "../../generated/prisma/enums.js";

export const createSprintSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Sprint name must be at least 3 characters")
      .max(100, "Sprint name must be at most 100 characters"),

    goal: z
      .string()
      .trim()
      .max(500, "Goal must be at most 500 characters")
      .optional(),

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

export const updateSprintSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Sprint name must be at least 3 characters")
      .max(100, "Sprint name must be at most 100 characters")
      .optional(),

    goal: z
      .string()
      .trim()
      .max(500, "Goal must be at most 500 characters")
      .nullable()
      .optional(),

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
  )
  .refine(
    (data) =>
      data.name !== undefined ||
      data.goal !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

export type CreateSprintInput = z.infer<typeof createSprintSchema>;

export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
