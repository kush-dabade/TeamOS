import { prisma } from "../../lib/prisma.js";
import { generateSlug } from "../../lib/slug.js";
import type {
  CreateProjectData,
  ListProjectsOptions,
} from "./project.types.js";

import { createActivity } from "../activity/activity.service.js";

import {
  ActivityEntityType,
  ActivityType,
} from "../../generated/prisma/enums.js";

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

async function generateUniqueProjectSlug(
  workspaceId: string,
  name: string,
): Promise<string> {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existingProject = await prisma.project.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug,
        },
      },
    });

    if (!existingProject) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function createProject(actorId: string, data: CreateProjectData) {
  const membership = await getWorkspaceMembership(data.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only workspace owners and admins can create projects");
  }

  const ownerMembership = await getWorkspaceMembership(
    data.workspaceId,
    data.ownerId,
  );

  if (!ownerMembership) {
    throw new Error("Project owner must be a workspace member");
  }

  const slug = await generateUniqueProjectSlug(data.workspaceId, data.name);

  const project = await prisma.project.create({
    data: {
      workspaceId: data.workspaceId,
      ownerId: data.ownerId,
      name: data.name,
      slug,

      ...(data.description !== undefined && {
        description: data.description,
      }),

      ...(data.startDate !== undefined && {
        startDate: data.startDate,
      }),

      ...(data.endDate !== undefined && {
        endDate: data.endDate,
      }),
    },
  });

  await createActivity({
    workspaceId: project.workspaceId,
    actorId,

    type: ActivityType.PROJECT_CREATED,

    entityType: ActivityEntityType.PROJECT,
    entityId: project.id,

    metadata: {
      projectName: project.name,
    },
  });

  return {
    id: project.id,
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function listProjects(
  actorId: string,
  options: ListProjectsOptions,
) {
  const membership = await getWorkspaceMembership(options.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  const projects = await prisma.project.findMany({
    where: {
      workspaceId: options.workspaceId,

      ...(options.status
        ? {
            status: options.status,
          }
        : {
            status: {
              not: "ARCHIVED",
            },
          }),
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return projects.map((project) => ({
    id: project.id,
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }));
}
