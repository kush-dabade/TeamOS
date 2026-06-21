import { prisma } from "../../lib/prisma.js";

import type { CreateSprintData } from "./sprint.types.js";

import { createActivity } from "../activity/activity.service.js";

import type { UpdateSprintInput } from "./sprint.schema.js";

import {
  ActivityEntityType,
  ActivityType,
} from "../../generated/prisma/enums.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

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
  });
}

async function findSprintById(sprintId: string) {
  return prisma.sprint.findUnique({
    where: {
      id: sprintId,
    },
  });
}

async function findSprintByProjectAndName(projectId: string, name: string) {
  return prisma.sprint.findFirst({
    where: {
      projectId,
      name,
    },
  });
}

export async function createSprint(actorId: string, data: CreateSprintData) {
  const project = await findProjectById(data.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new ForbiddenError(
      "Only workspace owners and admins can create sprints",
    );
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  const existingSprint = await findSprintByProjectAndName(
    project.id,
    data.name,
  );

  if (existingSprint) {
    throw new ValidationError(
      "A sprint with this name already exists in the project",
    );
  }

  const sprint = await prisma.sprint.create({
    data: {
      workspaceId: project.workspaceId,
      projectId: project.id,

      name: data.name,

      ...(data.goal !== undefined && {
        goal: data.goal,
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
    workspaceId: sprint.workspaceId,
    actorId,

    type: ActivityType.SPRINT_CREATED,

    entityType: ActivityEntityType.SPRINT,
    entityId: sprint.id,

    metadata: {
      sprintName: sprint.name,
    },
  });

  return {
    id: sprint.id,

    workspaceId: sprint.workspaceId,
    projectId: sprint.projectId,

    name: sprint.name,
    goal: sprint.goal,

    status: sprint.status,

    startDate: sprint.startDate,
    endDate: sprint.endDate,

    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
  };
}

export async function listSprints(actorId: string, projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await getWorkspaceMembership(project.workspaceId, actorId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  const sprints = await prisma.sprint.findMany({
    where: {
      projectId,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return sprints.map((sprint) => ({
    id: sprint.id,

    workspaceId: sprint.workspaceId,
    projectId: sprint.projectId,

    name: sprint.name,
    goal: sprint.goal,

    status: sprint.status,

    startDate: sprint.startDate,
    endDate: sprint.endDate,

    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
  }));
}

export async function getSprint(actorId: string, sprintId: string) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const membership = await getWorkspaceMembership(sprint.workspaceId, actorId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  return {
    id: sprint.id,

    workspaceId: sprint.workspaceId,
    projectId: sprint.projectId,

    name: sprint.name,
    goal: sprint.goal,

    status: sprint.status,

    startDate: sprint.startDate,
    endDate: sprint.endDate,

    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
  };
}

export async function updateSprint(
  actorId: string,
  sprintId: string,
  data: UpdateSprintInput,
) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const membership = await getWorkspaceMembership(sprint.workspaceId, actorId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new ForbiddenError(
      "Only workspace owners and admins can update sprints",
    );
  }

  const project = await findProjectById(sprint.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  if (
    data.name !== undefined &&
    data.name.toLowerCase() !== sprint.name.toLowerCase()
  ) {
    const existingSprint = await findSprintByProjectAndName(
      sprint.projectId,
      data.name,
    );

    if (existingSprint) {
      throw new ValidationError(
        "A sprint with this name already exists in the project",
      );
    }
  }

  const updatedSprint = await prisma.sprint.update({
    where: {
      id: sprint.id,
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.goal !== undefined && {
        goal: data.goal,
      }),

      ...(data.startDate !== undefined && {
        startDate: new Date(data.startDate),
      }),

      ...(data.endDate !== undefined && {
        endDate: new Date(data.endDate),
      }),
    },
  });

  const metadata: Record<string, string> = {};

  if (data.name !== undefined && data.name !== sprint.name) {
    metadata.oldName = sprint.name;
    metadata.newName = data.name;
  }

  if (data.goal !== undefined && data.goal !== sprint.goal) {
    metadata.oldGoal = sprint.goal ?? "";
    metadata.newGoal = data.goal ?? "";
  }

  if (Object.keys(metadata).length > 0) {
    await createActivity({
      workspaceId: updatedSprint.workspaceId,
      actorId,

      type: ActivityType.SPRINT_UPDATED,

      entityType: ActivityEntityType.SPRINT,
      entityId: updatedSprint.id,

      metadata,
    });
  }

  return {
    id: updatedSprint.id,

    workspaceId: updatedSprint.workspaceId,
    projectId: updatedSprint.projectId,

    name: updatedSprint.name,
    goal: updatedSprint.goal,

    status: updatedSprint.status,

    startDate: updatedSprint.startDate,
    endDate: updatedSprint.endDate,

    createdAt: updatedSprint.createdAt,
    updatedAt: updatedSprint.updatedAt,
  };
}

export { findSprintById };
