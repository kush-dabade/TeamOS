import { prisma } from "../../lib/prisma.js";

import type { CreateSprintData } from "./sprint.types.js";

import { createActivity } from "../activity/activity.service.js";

import type { UpdateSprintInput } from "./sprint.schema.js";

import {
  ActivityEntityType,
  ActivityType,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import {
  requireWorkspaceMembership,
  requireRole,
} from "../../shared/authorization/workspace-access.js";

import type { Sprint } from "../../generated/prisma/client.js";

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

async function findSprintByProjectAndName(
  projectId: string,
  name: string,
  excludeSprintId?: string,
) {
  return prisma.sprint.findFirst({
    where: {
      projectId,

      name: {
        equals: name,
        mode: "insensitive",
      },

      ...(excludeSprintId && {
        id: {
          not: excludeSprintId,
        },
      }),
    },
  });
}

async function findActiveSprintByProject(projectId: string) {
  return prisma.sprint.findFirst({
    where: {
      projectId,
      status: "ACTIVE",
    },
  });
}

function toSprintResponse(sprint: Sprint) {
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

export async function createSprint(actorId: string, data: CreateSprintData) {
  const project = await findProjectById(data.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await requireWorkspaceMembership(project.workspaceId, actorId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

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

    projectId: sprint.projectId,

    metadata: {
      sprintName: sprint.name,
    },
  });

  const response = toSprintResponse(sprint);

  emitToWorkspace(sprint.workspaceId, REALTIME_EVENTS.SPRINT_CREATED, {
    workspaceId: sprint.workspaceId,
    projectId: sprint.projectId,
    sprint: response,
  });

  return response;
}

export async function listSprints(actorId: string, projectId: string) {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  await requireWorkspaceMembership(project.workspaceId, actorId);

  const sprints = await prisma.sprint.findMany({
    where: {
      projectId,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return sprints.map(toSprintResponse);
}

export async function getSprint(actorId: string, sprintId: string) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  await requireWorkspaceMembership(sprint.workspaceId, actorId);

  return toSprintResponse(sprint);
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

  const membership = await requireWorkspaceMembership(sprint.workspaceId, actorId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  const project = await findProjectById(sprint.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  const effectiveStartDate =
    data.startDate !== undefined ? new Date(data.startDate) : sprint.startDate;

  const effectiveEndDate =
    data.endDate !== undefined ? new Date(data.endDate) : sprint.endDate;

  if (
    effectiveStartDate &&
    effectiveEndDate &&
    effectiveEndDate < effectiveStartDate
  ) {
    throw new ValidationError("End date must be after start date");
  }

  if (
    data.name !== undefined &&
    data.name.toLowerCase() !== sprint.name.toLowerCase()
  ) {
    const existingSprint = await findSprintByProjectAndName(
      sprint.projectId,
      data.name,
      sprint.id,
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

  if (data.startDate !== undefined) {
    metadata.startDateUpdated = "true";
  }

  if (data.endDate !== undefined) {
    metadata.endDateUpdated = "true";
  }

  if (Object.keys(metadata).length > 0) {
    await createActivity({
      workspaceId: updatedSprint.workspaceId,
      actorId,

      type: ActivityType.SPRINT_UPDATED,

      entityType: ActivityEntityType.SPRINT,
      entityId: updatedSprint.id,

      projectId: updatedSprint.projectId,

      metadata,
    });
  }

  const response = toSprintResponse(updatedSprint);

  emitToWorkspace(updatedSprint.workspaceId, REALTIME_EVENTS.SPRINT_UPDATED, {
    workspaceId: updatedSprint.workspaceId,
    projectId: updatedSprint.projectId,
    sprint: response,
  });

  return response;
}

export async function startSprint(actorId: string, sprintId: string) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const membership = await requireWorkspaceMembership(sprint.workspaceId, actorId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  const project = await findProjectById(sprint.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  if (sprint.status !== "PLANNED") {
    throw new ValidationError("Only planned sprints can be started");
  }

  const activeSprint = await findActiveSprintByProject(sprint.projectId);

  if (activeSprint && activeSprint.id !== sprint.id) {
    throw new ValidationError(
      "Another active sprint already exists for this project",
    );
  }

  const updatedSprint = await prisma.sprint.update({
    where: {
      id: sprint.id,
    },
    data: {
      status: "ACTIVE",
    },
  });

  await createActivity({
    workspaceId: updatedSprint.workspaceId,
    actorId,

    type: ActivityType.SPRINT_STARTED,

    entityType: ActivityEntityType.SPRINT,
    entityId: updatedSprint.id,

    projectId: updatedSprint.projectId,

    metadata: {
      sprintName: updatedSprint.name,
    },
  });

  const response = toSprintResponse(updatedSprint);

  emitToWorkspace(updatedSprint.workspaceId, REALTIME_EVENTS.SPRINT_STARTED, {
    workspaceId: updatedSprint.workspaceId,
    projectId: updatedSprint.projectId,
    sprint: response,
  });

  return response;
}

export async function completeSprint(actorId: string, sprintId: string) {
  const sprint = await findSprintById(sprintId);

  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const membership = await requireWorkspaceMembership(sprint.workspaceId, actorId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  const project = await findProjectById(sprint.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (project.status === "ARCHIVED") {
    throw new ValidationError("Archived projects cannot be modified");
  }

  if (sprint.status !== "ACTIVE") {
    throw new ValidationError("Only active sprints can be completed");
  }

  const updatedSprint = await prisma.sprint.update({
    where: {
      id: sprint.id,
    },
    data: {
      status: "COMPLETED",
    },
  });

  await createActivity({
    workspaceId: updatedSprint.workspaceId,
    actorId,

    type: ActivityType.SPRINT_COMPLETED,

    entityType: ActivityEntityType.SPRINT,
    entityId: updatedSprint.id,

    projectId: updatedSprint.projectId,

    metadata: {
      sprintName: updatedSprint.name,
    },
  });

  const response = toSprintResponse(updatedSprint);

  emitToWorkspace(updatedSprint.workspaceId, REALTIME_EVENTS.SPRINT_COMPLETED, {
    workspaceId: updatedSprint.workspaceId,
    projectId: updatedSprint.projectId,
    sprint: response,
  });

  return response;
}

export { findSprintById };
