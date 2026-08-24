import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createProjectDirect,
  createSprintDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

// Direct Prisma write, same rationale as every other *Direct fixture in
// tests/setup/fixtures.ts - archiving has no security-sensitive internals
// worth exercising through the HTTP layer just to set up a test fixture.
// Mirrors tests/attachment/attachment-archived-project.test.ts's identical
// local helper.
async function archiveProjectDirect(projectId: string) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });
}

// Direct Prisma write, same rationale as archiveProjectDirect above.
// signUpTestUser always signs up as "Test User" with a randomly generated
// email - People search needs distinguishable, deterministic name/email
// values to search for, so tests rename the user post sign-up rather than
// extending the shared auth fixture every other test file also relies on.
//
// Deliberately hyphen-free: the 'simple' text search config tokenizes a
// hyphenated compound (e.g. "test-abc123") into both the whole compound AND
// its parts, and buildPrefixSearchCte's per-lexeme `:*` round-trip through
// to_tsquery re-splits any lexeme that still contains a hyphen into a
// phrase (`<->`) query instead of a plain prefix match - a pre-existing
// characteristic of the shared search CTE (not something sprint/people
// search introduces) that would otherwise make a hyphenated fixture value
// silently fail to match its own prefix.
async function renameUserDirect(userId: string, name: string, email: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { name, email },
  });
}

describe("GET /api/v1/search - sprints and people", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("matches sprints by name", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const sprint = await createSprintDirect(workspace.id, project.id, "Onboardingrevamp Sprint");

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "Onboardingrevamp" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.sprints).toHaveLength(1);
    expect(res.body.data.sprints[0]).toMatchObject({
      id: sprint.id,
      name: sprint.name,
      goal: null,
      status: "PLANNED",
      projectId: project.id,
    });
  });

  it("matches sprints by goal", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    const sprint = await createSprintDirect(
      workspace.id,
      project.id,
      undefined,
      "Ship the billingoverhaul feature",
    );

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "billingoverhaul" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.sprints).toHaveLength(1);
    expect(res.body.data.sprints[0].id).toBe(sprint.id);
  });

  it("excludes sprints belonging to an archived project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await createSprintDirect(workspace.id, project.id, "Archivedprojectsprint Sprint");

    await archiveProjectDirect(project.id);

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "Archivedprojectsprint" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.sprints).toEqual([]);
  });

  it("matches workspace members by name", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const member = await signUpTestUser(app);
    await renameUserDirect(member.userId, "Alicesearchable Chen", member.email);
    await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "Alicesearchable" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.members[0]).toMatchObject({
      userId: member.userId,
      name: "Alicesearchable Chen",
      role: "MEMBER",
    });
  });

  it("matches workspace members by email", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const member = await signUpTestUser(app);
    await renameUserDirect(member.userId, member.name, "bobsearchable@example.com");
    await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "bobsearchable" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.members[0].userId).toBe(member.userId);
  });

  it("never returns another workspace's sprints or members", async () => {
    const ownerA = await signUpTestUser(app);
    const { workspace: workspaceA } = await createWorkspaceWithMember(ownerA.userId);
    const projectA = await createProjectDirect(workspaceA.id, ownerA.userId);
    await createSprintDirect(workspaceA.id, projectA.id, "Crosstenantsprint Sprint");
    const memberA = await signUpTestUser(app);
    await renameUserDirect(memberA.userId, "Crosstenantperson Doe", memberA.email);
    await addWorkspaceMember(workspaceA.id, memberA.userId, "MEMBER");

    const ownerB = await signUpTestUser(app);
    const { workspace: workspaceB } = await createWorkspaceWithMember(ownerB.userId);

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspaceB.id, q: "Crosstenant" })
      .set("Cookie", ownerB.cookie)
      .expect(200);

    expect(res.body.data.sprints).toEqual([]);
    expect(res.body.data.members).toEqual([]);
  });

  it("rejects search for a workspace the actor is not a member of", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await createSprintDirect(workspace.id, project.id, "Forbiddensprint Sprint");

    const outsider = await signUpTestUser(app);

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "Forbiddensprint" })
      .set("Cookie", outsider.cookie)
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.data).toBeUndefined();
  });

  it("returns matching projects, tasks, sprints, and people for one combined query", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId, "Combinedmatch Project");
    const task = await createTaskDirect(
      workspace.id,
      project.id,
      owner.userId,
      "Combinedmatch Task",
    );
    const sprint = await createSprintDirect(workspace.id, project.id, "Combinedmatch Sprint");
    const member = await signUpTestUser(app);
    await renameUserDirect(member.userId, "Combinedmatch Person", member.email);
    await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "Combinedmatch" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.projects.map((p: { id: string }) => p.id)).toEqual([project.id]);
    expect(res.body.data.tasks.map((t: { id: string }) => t.id)).toEqual([task.id]);
    expect(res.body.data.sprints.map((s: { id: string }) => s.id)).toEqual([sprint.id]);
    expect(res.body.data.members.map((m: { userId: string }) => m.userId)).toEqual([
      member.userId,
    ]);
  });

  it("still returns existing project and task results unaffected by the new entity types", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId, "Regressioncheck Project");
    const task = await createTaskDirect(
      workspace.id,
      project.id,
      owner.userId,
      "Regressioncheck Task",
    );

    const res = await request(app)
      .get("/api/v1/search")
      .query({ workspaceId: workspace.id, q: "Regressioncheck" })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projects[0].id).toBe(project.id);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].id).toBe(task.id);
    expect(res.body.data.sprints).toEqual([]);
    expect(res.body.data.members).toEqual([]);
  });
});
