import { prisma } from "../../lib/prisma.js";
import { generateSlug } from "../../lib/slug.js";
import type {
  CreateProjectData,
  ListProjectsOptions,
} from "./project.types.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import type { UpdateProjectInput } from "./project.schema.js";

import { createActivity } from "../activity/activity.service.js";

import {
  ActivityEntityType,
  ActivityType,
} from "../../generated/prisma/enums.js";

import type { Project } from "../../generated/prisma/client.js";

import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import {
  findWorkspaceMembership,
  requireWorkspaceMembership,
  requireRole,
} from "../../shared/authorization/workspace-access.js";

function toProjectResponse(project: Project) {
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
    throw new NotFoundError("Project not found");
  }

  await requireWorkspaceMembership(project.workspaceId, actorId);

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
    throw new NotFoundError("Project not found");
  }

  const membership = await requireWorkspaceMembership(project.workspaceId, actorId);

  requireRole(membership, ["OWNER", "ADMIN"]);

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be updated");
  }

  const oldName = project.name;
  const oldStatus = project.status;

  const metadata: Record<string, string> = {};

  if (data.name !== undefined && data.name !== oldName) {
    metadata.oldName = oldName;
    metadata.newName = data.name;
  }

  if (data.status !== undefined && data.status !== oldStatus) {
    metadata.oldStatus = oldStatus;
    metadata.newStatus = data.status;
  }

  let emitActivityCreated: () => void = () => {};

  const updatedProject = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
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

    if (Object.keys(metadata).length > 0) {
      emitActivityCreated = await createActivity(
        {
          workspaceId: updated.workspaceId,
          actorId,

          type: ActivityType.PROJECT_UPDATED,

          entityType: ActivityEntityType.PROJECT,
          entityId: updated.id,

          projectId: updated.id,

          metadata,
        },
        tx,
      );
    }

    return updated;
  });

  emitActivityCreated();

  const response = toProjectResponse(updatedProject);

  emitToWorkspace(updatedProject.workspaceId, REALTIME_EVENTS.PROJECT_UPDATED, {
    workspaceId: updatedProject.workspaceId,
    project: response,
  });

  return response;
}

export async function archiveProject(actorId: string, projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await requireWorkspaceMembership(project.workspaceId, actorId);

  requireRole(membership, ["OWNER", "ADMIN"]);

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Project is already archived");
  }

  let emitActivityCreated: () => void = () => {};

  const archivedProject = await prisma.$transaction(async (tx) => {
    const archived = await tx.project.update({
      where: {
        id: project.id,
      },
      data: {
        status: "ARCHIVED",
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: archived.workspaceId,
        actorId,

        type: ActivityType.PROJECT_ARCHIVED,

        entityType: ActivityEntityType.PROJECT,
        entityId: archived.id,

        projectId: archived.id,

        metadata: {
          projectName: archived.name,
        },
      },
      tx,
    );

    return archived;
  });

  emitActivityCreated();

  const response = toProjectResponse(archivedProject);

  emitToWorkspace(
    archivedProject.workspaceId,
    REALTIME_EVENTS.PROJECT_ARCHIVED,
    {
      workspaceId: archivedProject.workspaceId,
      project: response,
    },
  );

  return response;
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
  const membership = await requireWorkspaceMembership(data.workspaceId, actorId);

  requireRole(membership, ["OWNER", "ADMIN"]);

  // Not an actor-authorization check: this validates that the *proposed*
  // owner (a different user than the actor) is a workspace member, so it
  // stays a ValidationError rather than going through the ForbiddenError-only
  // authorization primitive.
  const ownerMembership = await findWorkspaceMembership(
    data.workspaceId,
    data.ownerId,
  );

  if (!ownerMembership) {
    throw new ValidationError("Project owner must be a workspace member");
  }

  const slug = await generateUniqueProjectSlug(data.workspaceId, data.name);

  let emitActivityCreated: () => void = () => {};

  const project = await prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
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

    emitActivityCreated = await createActivity(
      {
        workspaceId: createdProject.workspaceId,
        actorId,

        type: ActivityType.PROJECT_CREATED,

        entityType: ActivityEntityType.PROJECT,
        entityId: createdProject.id,

        projectId: createdProject.id,

        metadata: {
          projectName: createdProject.name,
        },
      },
      tx,
    );

    return createdProject;
  });

  emitActivityCreated();

  const response = toProjectResponse(project);

  emitToWorkspace(project.workspaceId, REALTIME_EVENTS.PROJECT_CREATED, {
    workspaceId: project.workspaceId,
    project: response,
  });

  return response;
}

export async function listProjects(
  actorId: string,
  options: ListProjectsOptions,
) {
  await requireWorkspaceMembership(options.workspaceId, actorId);

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

  return projects.map(toProjectResponse);
}
