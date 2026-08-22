import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createCommentDirect,
  setUpTaskWithOwner,
  signUpTestUser,
} from "../setup/fixtures.js";

// A single fixed instant shared by every "tied" comment in these tests - see
// activity-pagination.test.ts's identical constant for why: proving ordering
// stays deterministic when createdAt alone can't distinguish rows requires
// genuinely identical timestamps, not just narrowly-spaced `new Date()`
// calls that could coincidentally still be unique.
const TIED_CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

/**
 * cuid ids are lowercase-alphanumeric ASCII, so JS's default string sort and
 * Postgres's `ORDER BY "id" ASC` agree on their relative order - verified
 * against this project's own test database collation (digits sort before
 * letters in both), same as activity-pagination.test.ts's descending
 * equivalent. Comments order createdAt ASC (oldest first, chronological
 * thread order - see comments.service.ts's listComments), so the id
 * tiebreak here is plain ascending, not reversed.
 */
function sortIdsAscending(ids: string[]): string[] {
  return [...ids].sort();
}

describe("GET /api/v1/tasks/:taskId/comments pagination", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("defaults to page 1, limit 20 when no query params are given", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createCommentDirect(workspace.id, task.id, owner.userId, `Comment ${index}`),
      ),
    );

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 5, pages: 1 });
    expect(res.body.data.comments).toHaveLength(5);
  });

  it("applies explicit page/limit query params", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    // Strictly increasing createdAt, one second apart - Promise.all
    // preserves input-array order in its resolved output, and since
    // createdAt is monotonic in `index` here, `created` is already in the
    // exact ascending order the API is expected to return, independent of
    // actual insert-completion timing.
    const created = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        createCommentDirect(
          workspace.id,
          task.id,
          owner.userId,
          `Comment ${index}`,
          new Date(Date.now() + index * 1000),
        ),
      ),
    );

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ page: 2, limit: 10 })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.pagination).toEqual({ page: 2, limit: 10, total: 25, pages: 3 });

    const expectedIds = created.map((comment) => comment.id).slice(10, 20);
    const returnedIds = res.body.data.comments.map(
      (comment: { id: string }) => comment.id,
    );
    expect(returnedIds).toEqual(expectedIds);
  });

  it("keeps page boundaries stable and non-overlapping when many comments share the same createdAt", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    const COMMENT_COUNT = 10;
    const PAGE_LIMIT = 4;

    const created = await Promise.all(
      Array.from({ length: COMMENT_COUNT }, (_, index) =>
        createCommentDirect(
          workspace.id,
          task.id,
          owner.userId,
          `Comment ${index}`,
          TIED_CREATED_AT,
        ),
      ),
    );

    const expectedOrder = sortIdsAscending(created.map((comment) => comment.id));

    const page1 = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ page: 1, limit: PAGE_LIMIT })
      .set("Cookie", owner.cookie)
      .expect(200);

    const page2 = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ page: 2, limit: PAGE_LIMIT })
      .set("Cookie", owner.cookie)
      .expect(200);

    const page3 = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ page: 3, limit: PAGE_LIMIT })
      .set("Cookie", owner.cookie)
      .expect(200);

    const idsOf = (res: request.Response) =>
      res.body.data.comments.map((comment: { id: string }) => comment.id);

    const page1Ids: string[] = idsOf(page1);
    const page2Ids: string[] = idsOf(page2);
    const page3Ids: string[] = idsOf(page3);

    // Each page lands exactly on the expected slice of the globally sorted
    // order - the actual boundary-stability proof, not just "each page is
    // internally sorted."
    expect(page1Ids).toEqual(expectedOrder.slice(0, 4));
    expect(page2Ids).toEqual(expectedOrder.slice(4, 8));
    expect(page3Ids).toEqual(expectedOrder.slice(8, 10));

    // No id appears on more than one page.
    const allIds = [...page1Ids, ...page2Ids, ...page3Ids];
    expect(new Set(allIds).size).toBe(allIds.length);

    // Every created comment was traversed, exactly once, across all pages.
    expect(allIds.sort()).toEqual([...expectedOrder].sort());

    for (const res of [page1, page2, page3]) {
      expect(res.body.pagination.total).toBe(COMMENT_COUNT);
      expect(res.body.pagination.limit).toBe(PAGE_LIMIT);
      expect(res.body.pagination.pages).toBe(3);
    }

    expect(page1.body.pagination.page).toBe(1);
    expect(page2.body.pagination.page).toBe(2);
    expect(page3.body.pagination.page).toBe(3);
  });

  it("traverses a mixed-timestamp set exactly once across all pages, in createdAt ASC / id ASC order", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    // A mix of genuinely distinct timestamps and a tied cluster in the
    // middle, so this exercises both the plain createdAt-ASC case and the
    // id-ASC tiebreak within the same traversal.
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
        createCommentDirect(workspace.id, task.id, owner.userId, "Comment", createdAt),
      ),
    );

    // Independently derived from the created rows' own createdAt/id, not
    // from anything the API returns - this is what lets the final assertion
    // prove actual createdAt ASC, id ASC ordering rather than just "a
    // stable, self-consistent" one.
    const expectedIds = [...created]
      .sort((a, b) => {
        const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
        if (byCreatedAt !== 0) {
          return byCreatedAt;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .map((comment) => comment.id);

    const PAGE_LIMIT = 3;
    const seenIds = new Set<string>();
    const returnedIds: string[] = [];
    let page = 1;
    let totalPages: number;

    do {
      const res = await request(app)
        .get(`/api/v1/tasks/${task.id}/comments`)
        .query({ page, limit: PAGE_LIMIT })
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.pagination.total).toBe(created.length);
      totalPages = res.body.pagination.pages;

      const pageIds: string[] = res.body.data.comments.map(
        (comment: { id: string }) => comment.id,
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
    expect([...seenIds].sort()).toEqual(created.map((comment) => comment.id).sort());

    // The actual proof this test exists for: traversal order, across page
    // boundaries, matches createdAt ASC / id ASC exactly.
    expect(returnedIds).toEqual(expectedIds);
  });

  it("accepts the maximum allowed limit", async () => {
    const { owner, task } = await setUpTaskWithOwner(app);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ limit: 100 })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.pagination.limit).toBe(100);
  });

  it("rejects a limit above the maximum", async () => {
    const { owner, task } = await setUpTaskWithOwner(app);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ limit: 101 })
      .set("Cookie", owner.cookie)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid page and limit values", async () => {
    const { owner, task } = await setUpTaskWithOwner(app);

    const invalidQueries = [
      { page: 0 },
      { page: -1 },
      { limit: 0 },
      { page: "not-a-number" },
      { limit: "not-a-number" },
    ];

    for (const query of invalidQueries) {
      const res = await request(app)
        .get(`/api/v1/tasks/${task.id}/comments`)
        .query(query)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects listing comments for a task the actor is not a workspace member of", async () => {
    const { workspace, task, owner } = await setUpTaskWithOwner(app);
    const outsider = await signUpTestUser(app);

    await createCommentDirect(workspace.id, task.id, owner.userId);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set("Cookie", outsider.cookie)
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("never counts or returns another task's comments, regardless of pagination params", async () => {
    const taskA = await setUpTaskWithOwner(app);
    const taskB = await setUpTaskWithOwner(app);

    await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createCommentDirect(taskA.workspace.id, taskA.task.id, taskA.owner.userId, `A${index}`),
      ),
    );
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createCommentDirect(taskB.workspace.id, taskB.task.id, taskB.owner.userId, `B${index}`),
      ),
    );

    const res = await request(app)
      .get(`/api/v1/tasks/${taskA.task.id}/comments`)
      .query({ limit: 100 })
      .set("Cookie", taskA.owner.cookie)
      .expect(200);

    // The count query must scope identically to the findMany - a pagination
    // bug that filters findMany by taskId but forgets it on count would
    // inflate `total` (and therefore `pages`) with taskB's comments even
    // though they'd never actually appear in `data.comments`.
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.data.comments).toHaveLength(3);

    const returnedContents = res.body.data.comments.map(
      (comment: { content: string }) => comment.content,
    );
    expect(returnedContents.sort()).toEqual(["A0", "A1", "A2"]);
  });

  it("returns an empty page with correct metadata when paging past the available records", async () => {
    const { owner, workspace, task } = await setUpTaskWithOwner(app);

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createCommentDirect(workspace.id, task.id, owner.userId, `Comment ${index}`),
      ),
    );

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .query({ page: 5, limit: 20 })
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.data.comments).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 5, limit: 20, total: 5, pages: 1 });
  });
});
