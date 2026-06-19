import { prisma } from "../../lib/prisma.js";
import { generateSlug } from "../../lib/slug.js";
import type {
  CreateProjectData,
  ListProjectsOptions,
} from "./project.types.js";

import type { UpdateProjectInput } from "./project.schema.js";

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

async function findProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getProject(actorId: string, projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

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

    owner: {
      id: project.owner.id,
      name: project.owner.name,
      email: project.owner.email,
    },
  };
}

export async function updateProject(
  actorId: string,
  projectId: string,
  data: UpdateProjectInput,
) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only workspace owners and admins can update projects");
  }

  if (project.status === "ARCHIVED") {
    throw new Error("Archived projects cannot be updated");
  }

  const oldName = project.name;
  const oldStatus = project.status;

  const updatedProject = await prisma.project.update({
    where: {
      id: project.id,
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.description !== undefined && {
        description: data.description,
      }),

      ...(data.status !== undefined && {
        status: data.status,
      }),
    },
  });

  const metadata: Record<string, string> = {};

  if (data.name !== undefined && data.name !== oldName) {
    metadata.oldName = oldName;
    metadata.newName = data.name;
  }

  if (data.status !== undefined && data.status !== oldStatus) {
    metadata.oldStatus = oldStatus;
    metadata.newStatus = data.status;
  }

  if (Object.keys(metadata).length > 0) {
    await createActivity({
      workspaceId: updatedProject.workspaceId,
      actorId,

      type: ActivityType.PROJECT_UPDATED,

      entityType: ActivityEntityType.PROJECT,
      entityId: updatedProject.id,

      metadata,
    });
  }

  return {
    id: updatedProject.id,
    workspaceId: updatedProject.workspaceId,
    ownerId: updatedProject.ownerId,

    name: updatedProject.name,
    slug: updatedProject.slug,
    description: updatedProject.description,
    status: updatedProject.status,

    startDate: updatedProject.startDate,
    endDate: updatedProject.endDate,

    createdAt: updatedProject.createdAt,
    updatedAt: updatedProject.updatedAt,
  };
}

export async function archiveProject(actorId: string, projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new Error("You are not a member of this workspace");
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only workspace owners and admins can archive projects");
  }

  if (project.status === "ARCHIVED") {
    throw new Error("Project is already archived");
  }

  const archivedProject = await prisma.project.update({
    where: {
      id: project.id,
    },
    data: {
      status: "ARCHIVED",
    },
  });

  await createActivity({
    workspaceId: archivedProject.workspaceId,
    actorId,

    type: ActivityType.PROJECT_ARCHIVED,

    entityType: ActivityEntityType.PROJECT,
    entityId: archivedProject.id,

    metadata: {
      projectName: archivedProject.name,
    },
  });

  return {
    id: archivedProject.id,
    status: archivedProject.status,
  };
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
