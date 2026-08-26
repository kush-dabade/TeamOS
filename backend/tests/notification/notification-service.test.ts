import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createNotificationDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

// A single fixed instant shared by every "tied" notification in these tests
// - same technique as tests/activity/activity-pagination.test.ts's identical
// constant: proving the id-DESC tiebreak is deterministic requires genuinely
// identical timestamps, not just narrowly-spaced `new Date()` calls that
// could coincidentally still be unique.
const TIED_CREATED_AT = new Date("2026-01-15T12:00:00.000Z");

// Decodes a real cursor the API returned, independently of
// notification.service.ts's own decodeNotificationCursor - this is what
// lets a test assert the actual wire format (base64 of {createdAt, id})
// rather than just trusting the internal encoder/decoder agree with
// themselves.
function decodeCursorForAssertion(cursor: string): { createdAt: string; id: string } {
  return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
}

describe("notification service", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  describe("GET /api/v1/notifications - cursor pagination", () => {
    it("returns all of the recipient's notifications with default pagination when under the limit", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      const created = await Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          createNotificationDirect(
            workspace.id,
            user.userId,
            new Date(Date.now() + index * 1000),
          ),
        ),
      );

      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", user.cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(3);
      expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });

      const returnedIds = res.body.data.notifications.map(
        (notification: { id: string }) => notification.id,
      );
      expect(returnedIds.sort()).toEqual(created.map((n) => n.id).sort());
    });

    it("applies an explicit limit, reports hasMore/nextCursor, and encodes the cursor as base64(JSON({createdAt, id}))", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      const created = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          createNotificationDirect(
            workspace.id,
            user.userId,
            new Date(Date.now() + index * 1000),
          ),
        ),
      );

      const expectedOrder = [...created].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const res = await request(app)
        .get("/api/v1/notifications")
        .query({ limit: 2 })
        .set("Cookie", user.cookie)
        .expect(200);

      expect(res.body.data.notifications).toHaveLength(2);
      expect(res.body.pagination.hasMore).toBe(true);
      expect(typeof res.body.pagination.nextCursor).toBe("string");

      const returnedIds = res.body.data.notifications.map(
        (notification: { id: string }) => notification.id,
      );
      expect(returnedIds).toEqual(expectedOrder.slice(0, 2).map((n) => n.id));

      const decoded = decodeCursorForAssertion(res.body.pagination.nextCursor);
      const secondItem = expectedOrder[1]!;
      expect(decoded).toEqual({
        createdAt: secondItem.createdAt.toISOString(),
        id: secondItem.id,
      });
    });

    it("traverses all notifications exactly once across cursor pages, in createdAt DESC / id DESC order", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      // A mix of distinct timestamps and a tied cluster, same shape as
      // activity-pagination.test.ts's mixed-timestamp traversal test -
      // exercises both the plain createdAt-DESC case and the id-DESC
      // tiebreak within the same traversal.
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
          createNotificationDirect(workspace.id, user.userId, createdAt),
        ),
      );

      // Independently derived from the created rows' own createdAt/id, not
      // from anything the API returns.
      const expectedIds = [...created]
        .sort((a, b) => {
          const byCreatedAt = b.createdAt.getTime() - a.createdAt.getTime();
          if (byCreatedAt !== 0) {
            return byCreatedAt;
          }
          return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
        })
        .map((notification) => notification.id);

      const LIMIT = 3;
      const seenIds = new Set<string>();
      const returnedIds: string[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await request(app)
          .get("/api/v1/notifications")
          .query({ limit: LIMIT, ...(cursor ? { cursor } : {}) })
          .set("Cookie", user.cookie)
          .expect(200);

        const pageIds: string[] = res.body.data.notifications.map(
          (notification: { id: string }) => notification.id,
        );

        for (const id of pageIds) {
          expect(seenIds.has(id)).toBe(false);
          seenIds.add(id);
        }

        returnedIds.push(...pageIds);

        hasMore = res.body.pagination.hasMore;
        cursor = res.body.pagination.nextCursor ?? undefined;
      }

      expect(seenIds.size).toBe(created.length);
      // The actual proof this test exists for: traversal order, across
      // cursor pages, matches createdAt DESC / id DESC exactly.
      expect(returnedIds).toEqual(expectedIds);
    });

    it("excludes soft-deleted notifications", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      const active = await createNotificationDirect(workspace.id, user.userId, new Date());
      await createNotificationDirect(workspace.id, user.userId, new Date(), {
        deletedAt: new Date(),
      });

      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", user.cookie)
        .expect(200);

      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].id).toBe(active.id);
    });

    it("does not return another user's notifications", async () => {
      const userA = await signUpTestUser(app);
      const userB = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(userA.userId);

      await createNotificationDirect(workspace.id, userA.userId, new Date());
      const ownNotification = await createNotificationDirect(
        workspace.id,
        userB.userId,
        new Date(),
      );

      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", userB.cookie)
        .expect(200);

      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].id).toBe(ownNotification.id);
    });
  });

  describe("GET /api/v1/notifications - invalid cursor", () => {
    it("rejects a cursor that isn't valid base64-encoded JSON", async () => {
      const user = await signUpTestUser(app);

      const malformedCursor = Buffer.from("this is not json").toString("base64");

      const res = await request(app)
        .get("/api/v1/notifications")
        .query({ cursor: malformedCursor })
        .set("Cookie", user.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Invalid pagination cursor");
    });

    it("rejects a cursor that decodes to valid JSON but the wrong shape", async () => {
      const user = await signUpTestUser(app);

      const wrongShapeCursor = Buffer.from(JSON.stringify({ foo: "bar" })).toString(
        "base64",
      );

      const res = await request(app)
        .get("/api/v1/notifications")
        .query({ cursor: wrongShapeCursor })
        .set("Cookie", user.cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/v1/notifications - cursor ownership isolation", () => {
    it("does not widen another user's results when supplied a real cursor from a different recipient", async () => {
      const userA = await signUpTestUser(app);
      const userB = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(userA.userId);

      // Only userA has any notifications - userB has none at all, so any
      // notification returned to userB using userA's cursor could only ever
      // be userA's data leaking across the recipient boundary.
      await Promise.all(
        Array.from({ length: 2 }, (_, index) =>
          createNotificationDirect(
            workspace.id,
            userA.userId,
            new Date(Date.now() + index * 1000),
          ),
        ),
      );

      const userAListRes = await request(app)
        .get("/api/v1/notifications")
        .query({ limit: 1 })
        .set("Cookie", userA.cookie)
        .expect(200);

      const userACursor = userAListRes.body.pagination.nextCursor as string;
      expect(userACursor).toEqual(expect.any(String));

      const res = await request(app)
        .get("/api/v1/notifications")
        .query({ cursor: userACursor })
        .set("Cookie", userB.cookie)
        .expect(200);

      expect(res.body.data.notifications).toEqual([]);
      expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
    });
  });

  describe("PATCH /api/v1/notifications/:notificationId/read", () => {
    it("marks a notification as read and persists isRead/readAt", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);
      const notification = await createNotificationDirect(
        workspace.id,
        user.userId,
        new Date(),
      );

      const res = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set("Cookie", user.cookie)
        .expect(200);

      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).not.toBeNull();

      const persisted = await prisma.notification.findUniqueOrThrow({
        where: { id: notification.id },
      });
      expect(persisted.isRead).toBe(true);
      expect(persisted.readAt).not.toBeNull();
    });

    it("returns 404 for a notification that does not exist", async () => {
      const user = await signUpTestUser(app);

      const res = await request(app)
        .patch("/api/v1/notifications/does-not-exist/read")
        .set("Cookie", user.cookie)
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects marking another user's notification as read", async () => {
      const owner = await signUpTestUser(app);
      const outsider = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const notification = await createNotificationDirect(
        workspace.id,
        owner.userId,
        new Date(),
      );

      const res = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set("Cookie", outsider.cookie)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");

      const unchanged = await prisma.notification.findUniqueOrThrow({
        where: { id: notification.id },
      });
      expect(unchanged.isRead).toBe(false);
      expect(unchanged.readAt).toBeNull();
    });

    it("is idempotent on an already-read notification, and does not rewrite readAt", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);
      const notification = await createNotificationDirect(
        workspace.id,
        user.userId,
        new Date(),
      );

      const first = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set("Cookie", user.cookie)
        .expect(200);

      const second = await request(app)
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set("Cookie", user.cookie)
        .expect(200);

      expect(second.body.data.isRead).toBe(true);
      // The actual point of this test: a second markRead on an
      // already-read notification must not touch readAt again -
      // notification.service.ts's markNotificationAsRead returns the
      // existing row unchanged when isRead is already true, rather than
      // re-running the update.
      expect(second.body.data.readAt).toBe(first.body.data.readAt);
    });
  });

  describe("PATCH /api/v1/notifications/read-all", () => {
    it("marks all of the authenticated user's unread, non-deleted notifications as read and returns the count", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      await Promise.all([
        createNotificationDirect(workspace.id, user.userId, new Date()),
        createNotificationDirect(workspace.id, user.userId, new Date()),
        // Already read - should not be double-counted, but must remain read.
        createNotificationDirect(workspace.id, user.userId, new Date(), {
          isRead: true,
          readAt: new Date(),
        }),
        // Soft-deleted - must be excluded entirely.
        createNotificationDirect(workspace.id, user.userId, new Date(), {
          deletedAt: new Date(),
        }),
      ]);

      const res = await request(app)
        .patch("/api/v1/notifications/read-all")
        .set("Cookie", user.cookie)
        .expect(200);

      expect(res.body.data.updated).toBe(2);

      const stillUnread = await prisma.notification.count({
        where: { recipientId: user.userId, isRead: false, deletedAt: null },
      });
      expect(stillUnread).toBe(0);
    });

    it("does not modify another user's unread notifications", async () => {
      const userA = await signUpTestUser(app);
      const userB = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(userA.userId);

      const otherUsersNotification = await createNotificationDirect(
        workspace.id,
        userB.userId,
        new Date(),
      );

      await request(app)
        .patch("/api/v1/notifications/read-all")
        .set("Cookie", userA.cookie)
        .expect(200);

      const unchanged = await prisma.notification.findUniqueOrThrow({
        where: { id: otherUsersNotification.id },
      });
      expect(unchanged.isRead).toBe(false);
      expect(unchanged.readAt).toBeNull();
    });

    it("returns 0 and changes nothing further on a second call", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);
      await createNotificationDirect(workspace.id, user.userId, new Date());

      await request(app)
        .patch("/api/v1/notifications/read-all")
        .set("Cookie", user.cookie)
        .expect(200);

      const second = await request(app)
        .patch("/api/v1/notifications/read-all")
        .set("Cookie", user.cookie)
        .expect(200);

      expect(second.body.data.updated).toBe(0);
    });
  });

  describe("GET /api/v1/notifications/unread-count", () => {
    it("returns the correct count, excluding read and soft-deleted notifications", async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      await Promise.all([
        createNotificationDirect(workspace.id, user.userId, new Date()),
        createNotificationDirect(workspace.id, user.userId, new Date()),
        createNotificationDirect(workspace.id, user.userId, new Date(), {
          isRead: true,
          readAt: new Date(),
        }),
        createNotificationDirect(workspace.id, user.userId, new Date(), {
          deletedAt: new Date(),
        }),
      ]);

      const res = await request(app)
        .get("/api/v1/notifications/unread-count")
        .set("Cookie", user.cookie)
        .expect(200);

      expect(res.body.data.count).toBe(2);
    });

    it("does not count another user's unread notifications", async () => {
      const userA = await signUpTestUser(app);
      const userB = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(userA.userId);

      await createNotificationDirect(workspace.id, userB.userId, new Date());

      const res = await request(app)
        .get("/api/v1/notifications/unread-count")
        .set("Cookie", userA.cookie)
        .expect(200);

      expect(res.body.data.count).toBe(0);
    });
  });
});
