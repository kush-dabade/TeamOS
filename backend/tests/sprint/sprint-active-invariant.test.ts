import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createSprintDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

const ANOTHER_ACTIVE_SPRINT_MESSAGE =
  "Another active sprint already exists for this project";

describe("One ACTIVE sprint per project invariant", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("rejects starting a second sprint in the same project once one is ACTIVE", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const sprintA = await createSprintDirect(workspace.id, project.id, "Sprint A");
    const sprintB = await createSprintDirect(workspace.id, project.id, "Sprint B");

    const firstStart = await request(app)
      .post(`/api/v1/sprints/${sprintA.id}/start`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(firstStart.body.data.status).toBe("ACTIVE");

    const secondStart = await request(app)
      .post(`/api/v1/sprints/${sprintB.id}/start`)
      .set("Cookie", owner.cookie)
      .expect(400);

    expect(secondStart.body.success).toBe(false);
    expect(secondStart.body.error.code).toBe("VALIDATION_ERROR");
    expect(secondStart.body.error.message).toBe(ANOTHER_ACTIVE_SPRINT_MESSAGE);

    const activeSprints = await prisma.sprint.findMany({
      where: { projectId: project.id, status: "ACTIVE" },
    });

    expect(activeSprints).toHaveLength(1);
    expect(activeSprints[0]?.id).toBe(sprintA.id);

    const sprintBUnchanged = await prisma.sprint.findUniqueOrThrow({
      where: { id: sprintB.id },
    });
    expect(sprintBUnchanged.status).toBe("PLANNED");
  });

  it("allows each project to independently have its own ACTIVE sprint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const projectA = await createProjectDirect(workspace.id, owner.userId, "Project A");
    const projectB = await createProjectDirect(workspace.id, owner.userId, "Project B");

    const sprintA = await createSprintDirect(workspace.id, projectA.id, "Sprint A");
    const sprintB = await createSprintDirect(workspace.id, projectB.id, "Sprint B");

    const startA = await request(app)
      .post(`/api/v1/sprints/${sprintA.id}/start`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const startB = await request(app)
      .post(`/api/v1/sprints/${sprintB.id}/start`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(startA.body.data.status).toBe("ACTIVE");
    expect(startB.body.data.status).toBe("ACTIVE");

    const [reloadedA, reloadedB] = await Promise.all([
      prisma.sprint.findUniqueOrThrow({ where: { id: sprintA.id } }),
      prisma.sprint.findUniqueOrThrow({ where: { id: sprintB.id } }),
    ]);

    expect(reloadedA.status).toBe("ACTIVE");
    expect(reloadedB.status).toBe("ACTIVE");
  });

  it("resolves two concurrent activations in the same project to exactly one winner, backed by the real database constraint", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const sprintA = await createSprintDirect(workspace.id, project.id, "Sprint A");
    const sprintB = await createSprintDirect(workspace.id, project.id, "Sprint B");

    // Fired concurrently against the real running app / real Postgres
    // connection pool - not a mocked P2002 - so both requests' service-level
    // pre-checks can genuinely race each other before either transaction
    // commits. Whichever mechanism actually decides the winner (the
    // application-level pre-check or the partial unique index backstop),
    // the externally-visible outcome must be identical: exactly one 200,
    // exactly one 400 with the same domain error.
    const [responseA, responseB] = await Promise.all([
      request(app)
        .post(`/api/v1/sprints/${sprintA.id}/start`)
        .set("Cookie", owner.cookie),
      request(app)
        .post(`/api/v1/sprints/${sprintB.id}/start`)
        .set("Cookie", owner.cookie),
    ]);

    const results = [
      { sprintId: sprintA.id, response: responseA },
      { sprintId: sprintB.id, response: responseB },
    ];

    const winners = results.filter((r) => r.response.status === 200);
    const losers = results.filter((r) => r.response.status === 400);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    expect(winners[0]?.response.body.data.status).toBe("ACTIVE");

    expect(losers[0]?.response.body.success).toBe(false);
    expect(losers[0]?.response.body.error.code).toBe("VALIDATION_ERROR");
    expect(losers[0]?.response.body.error.message).toBe(
      ANOTHER_ACTIVE_SPRINT_MESSAGE,
    );

    // Database ends with exactly one ACTIVE sprint for the project, and
    // it's the winner's.
    const activeSprints = await prisma.sprint.findMany({
      where: { projectId: project.id, status: "ACTIVE" },
    });
    expect(activeSprints).toHaveLength(1);
    expect(activeSprints[0]?.id).toBe(winners[0]?.sprintId);

    // The loser's sprint is untouched - still PLANNED, not left in some
    // partially-applied state. `losers` was already asserted to have
    // exactly one element above, so the non-null assertion is safe here -
    // same pattern as tests/queues/deterministic-job-ids.test.ts's
    // `matching[0]!.data...` after an equivalent length assertion.
    const loserSprint = await prisma.sprint.findUniqueOrThrow({
      where: { id: losers[0]!.sprintId },
    });
    expect(loserSprint.status).toBe("PLANNED");

    // The loser's transaction rolled back entirely - it must not have left
    // behind a SPRINT_STARTED activity row for a sprint that never actually
    // activated. Exactly one SPRINT_STARTED activity exists for these two
    // sprints combined, and it belongs to the winner.
    const sprintStartedActivities = await prisma.activity.findMany({
      where: {
        type: "SPRINT_STARTED",
        entityId: { in: [sprintA.id, sprintB.id] },
      },
    });
    expect(sprintStartedActivities).toHaveLength(1);
    expect(sprintStartedActivities[0]?.entityId).toBe(winners[0]?.sprintId);
  });
});
