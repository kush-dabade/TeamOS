import { Prisma } from "../../generated/prisma/client.js";
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

  let emitActivityCreated: () => void = () => {};

  const sprint = await prisma.$transaction(async (tx) => {
    const createdSprint = await tx.sprint.create({
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

    emitActivityCreated = await createActivity(
      {
        workspaceId: createdSprint.workspaceId,
        actorId,

        type: ActivityType.SPRINT_CREATED,

        entityType: ActivityEntityType.SPRINT,
        entityId: createdSprint.id,

        projectId: createdSprint.projectId,

        metadata: {
          sprintName: createdSprint.name,
        },
      },
      tx,
    );

    return createdSprint;
  });

  emitActivityCreated();

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

  if (sprint.status === "COMPLETED") {
    throw new ValidationError("Completed sprints cannot be modified");
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

  let emitActivityCreated: () => void = () => {};

  const updatedSprint = await prisma.$transaction(async (tx) => {
    const updated = await tx.sprint.update({
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

    if (Object.keys(metadata).length > 0) {
      emitActivityCreated = await createActivity(
        {
          workspaceId: updated.workspaceId,
          actorId,

          type: ActivityType.SPRINT_UPDATED,

          entityType: ActivityEntityType.SPRINT,
          entityId: updated.id,

          projectId: updated.projectId,

          metadata,
        },
        tx,
      );
    }

    return updated;
  });

  emitActivityCreated();

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

  let emitActivityCreated: () => void = () => {};

  // The service-level `findActiveSprintByProject` check above is a
  // check-then-write - it can't close the race where two requests both
  // pass it before either commits. The "Sprint_projectId_active_unique"
  // partial unique index (see the comment on the Sprint model in
  // schema.prisma) is what actually closes that race: only one of two
  // concurrent activations can win the `status: "ACTIVE"` update below,
  // and the loser gets a Postgres unique-violation, surfaced by Prisma as
  // P2002. This transaction's only write to Sprint is that status update
  // (it doesn't touch `name`, so the other Sprint unique index -
  // @@unique([projectId, name]) - can't be the cause), so any P2002 here
  // can only be that race, not an unrelated conflict from some other
  // constraint or a different call site - it's translated into the exact
  // same domain error the pre-check above throws, so a client sees one
  // consistent failure shape regardless of which path caught it.
  let updatedSprint: Sprint;

  try {
    updatedSprint = await prisma.$transaction(async (tx) => {
      const updated = await tx.sprint.update({
        where: {
          id: sprint.id,
        },
        data: {
          status: "ACTIVE",
        },
      });

      emitActivityCreated = await createActivity(
        {
          workspaceId: updated.workspaceId,
          actorId,

          type: ActivityType.SPRINT_STARTED,

          entityType: ActivityEntityType.SPRINT,
          entityId: updated.id,

          projectId: updated.projectId,

          metadata: {
            sprintName: updated.name,
          },
        },
        tx,
      );

      return updated;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ValidationError(
        "Another active sprint already exists for this project",
      );
    }

    throw error;
  }

  emitActivityCreated();

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

  let emitActivityCreated: () => void = () => {};

  const updatedSprint = await prisma.$transaction(async (tx) => {
    const updated = await tx.sprint.update({
      where: {
        id: sprint.id,
      },
      data: {
        status: "COMPLETED",
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId: updated.workspaceId,
        actorId,

        type: ActivityType.SPRINT_COMPLETED,

        entityType: ActivityEntityType.SPRINT,
        entityId: updated.id,

        projectId: updated.projectId,

        metadata: {
          sprintName: updated.name,
        },
      },
      tx,
    );

    return updated;
  });

  emitActivityCreated();

  const response = toSprintResponse(updatedSprint);

  emitToWorkspace(updatedSprint.workspaceId, REALTIME_EVENTS.SPRINT_COMPLETED, {
    workspaceId: updatedSprint.workspaceId,
    projectId: updatedSprint.projectId,
    sprint: response,
  });

  return response;
}

export { findSprintById };
