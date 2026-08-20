import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createActivityDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

// A single fixed instant shared by every "tied" activity in these tests.
// The whole point is to prove ordering stays deterministic when createdAt
// alone can't distinguish rows - Postgres/Prisma give no ordering guarantee
// across ties without an explicit tiebreaker column, so every activity
// below that's meant to collide uses exactly this value rather than
// `new Date()` (which could vary by the millisecond between inserts and
// accidentally still be unique).
const TIED_CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

/**
 * cuid ids are lowercase-alphanumeric ASCII, so JS's default string sort
 * and Postgres's `ORDER BY "id" DESC` agree on their relative order -
 * verified against this project's own test database collation (digits sort
 * before letters in both). Sorting the *known, locally-created* ids this
 * way gives an independently-derived expected order to assert the API
 * response against, rather than asserting the response is sorted relative
 * to itself.
 */
function sortIdsDescending(ids: string[]): string[] {
  return [...ids].sort().reverse();
}

describe("GET /api/v1/workspaces/:workspaceId/activity pagination", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("orders activities with identical createdAt deterministically by id DESC", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const created = await Promise.all(
      Array.from({ length: 5 }, () =>
        createActivityDirect(workspace.id, owner.userId, TIED_CREATED_AT),
      ),
    );

    const expectedOrder = sortIdsDescending(created.map((activity) => activity.id));

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/activity`)
      .query({ limit: 10 })
      .set("Cookie", owner.cookie)
      .expect(200);

    const returnedIds = res.body.data.activities.map(
      (activity: { id: string }) => activity.id,
    );

    expect(returnedIds).toEqual(expectedOrder);
  });

  it("keeps page boundaries stable and non-overlapping when many activities share the same createdAt", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const ACTIVITY_COUNT = 10;
    const PAGE_LIMIT = 4;

    const created = await Promise.all(
      Array.from({ length: ACTIVITY_COUNT }, () =>
        createActivityDirect(workspace.id, owner.userId, TIED_CREATED_AT),
      ),
    );

    const expectedOrder = sortIdsDescending(created.map((activity) => activity.id));

    const page1 = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/activity`)
      .query({ page: 1, limit: PAGE_LIMIT })
      .set("Cookie", owner.cookie)
      .expect(200);

    const page2 = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/activity`)
      .query({ page: 2, limit: PAGE_LIMIT })
      .set("Cookie", owner.cookie)
      .expect(200);

    const page3 = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/activity`)
      .query({ page: 3, limit: PAGE_LIMIT })
      .set("Cookie", owner.cookie)
      .expect(200);

    const idsOf = (res: request.Response) =>
      res.body.data.activities.map((activity: { id: string }) => activity.id);

    const page1Ids: string[] = idsOf(page1);
    const page2Ids: string[] = idsOf(page2);
    const page3Ids: string[] = idsOf(page3);

    // Each page lands exactly on the expected slice of the globally sorted
    // order - this is the actual boundary-stability proof, not just "each
    // page is internally sorted."
    expect(page1Ids).toEqual(expectedOrder.slice(0, 4));
    expect(page2Ids).toEqual(expectedOrder.slice(4, 8));
    expect(page3Ids).toEqual(expectedOrder.slice(8, 10));

    // No id appears on more than one page.
    const allIds = [...page1Ids, ...page2Ids, ...page3Ids];
    expect(new Set(allIds).size).toBe(allIds.length);

    // Every created activity was traversed, exactly once, across all pages.
    expect(allIds.sort()).toEqual([...expectedOrder].sort());

    for (const res of [page1, page2, page3]) {
      expect(res.body.pagination.total).toBe(ACTIVITY_COUNT);
      expect(res.body.pagination.limit).toBe(PAGE_LIMIT);
      expect(res.body.pagination.pages).toBe(3);
    }

    expect(page1.body.pagination.page).toBe(1);
    expect(page2.body.pagination.page).toBe(2);
    expect(page3.body.pagination.page).toBe(3);
  });

  it("traverses a mixed-timestamp set exactly once across all pages, with correct pagination metadata", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    // A mix of genuinely distinct timestamps and a tied cluster in the
    // middle, so this test exercises both the plain createdAt-DESC case and
    // the id-DESC tiebreak within the same traversal.
    const timestamps = [
      new Date("2026-01-10T00:00:00.000Z"),
      new Date("2026-01-11T00:00:00.000Z"),
      TIED_CREATED_AT,
      TIED_CREATED_AT,
      TIED_CREATED_AT,
      new Date("2026-01-20T00:00:00.000Z"),
      new Date("2026-01-21T00:00:00.000Z"),
    ];

    const created = await Promise.all(
      timestamps.map((createdAt) =>
        createActivityDirect(workspace.id, owner.userId, createdAt),
      ),
    );

    // Independently derived from the created rows' own createdAt/id, not
    // from anything the API returns - this is what lets the final
    // assertion prove actual createdAt DESC, id DESC ordering rather than
    // just "a stable, self-consistent" one. A pagination bug that returns
    // every row exactly once, with no duplicates, but in some other stable
    // order (e.g. id DESC only, or insertion order) would satisfy every
    // other assertion in this test but fail this one.
    const expectedIds = [...created]
      .sort((a, b) => {
        const byCreatedAt = b.createdAt.getTime() - a.createdAt.getTime();
        if (byCreatedAt !== 0) {
          return byCreatedAt;
        }
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      })
      .map((activity) => activity.id);

    const PAGE_LIMIT = 3;
    const seenIds = new Set<string>();
    const returnedIds: string[] = [];
    let page = 1;
    let totalPages: number;

    do {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspace.id}/activity`)
        .query({ page, limit: PAGE_LIMIT })
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.pagination.total).toBe(created.length);
      totalPages = res.body.pagination.pages;

      const pageIds: string[] = res.body.data.activities.map(
        (activity: { id: string }) => activity.id,
      );

      for (const id of pageIds) {
        expect(seenIds.has(id)).toBe(false);
        seenIds.add(id);
      }

      returnedIds.push(...pageIds);

      page++;
    } while (page <= totalPages);

    expect(totalPages).toBe(Math.ceil(created.length / PAGE_LIMIT));
    expect(seenIds.size).toBe(created.length);
    expect([...seenIds].sort()).toEqual(created.map((a) => a.id).sort());

    // The actual proof this test exists for: traversal order, across page
    // boundaries, matches createdAt DESC / id DESC exactly.
    expect(returnedIds).toEqual(expectedIds);
  });
});
