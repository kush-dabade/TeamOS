import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import { signUpTestUser } from "../setup/fixtures.js";

async function uploadRealAvatar(
  user: { cookie: string },
  content = "avatar bytes probe",
  fileName = "avatar.png",
) {
  await request(app)
    .post("/api/v1/users/me/avatar")
    .set("Cookie", user.cookie)
    .attach("file", Buffer.from(content), {
      filename: fileName,
      contentType: "image/png",
    })
    .expect(200);
}

describe("GET /api/v1/users/:id/avatar", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("streams another user's avatar bytes with the correct headers", async () => {
    const owner = await signUpTestUser(app);
    const viewer = await signUpTestUser(app);

    const content = "avatar bytes probe";
    await uploadRealAvatar(owner, content);

    const res = await request(app)
      .get(`/api/v1/users/${owner.userId}/avatar`)
      .set("Cookie", viewer.cookie)
      .expect(200);

    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-length"]).toBe(String(Buffer.byteLength(content)));
    expect(res.headers["cache-control"]).toBe("private, max-age=0, must-revalidate");
    expect(res.body).toEqual(Buffer.from(content));
  });

  it("does not require the requester to share a workspace with the target user", async () => {
    const owner = await signUpTestUser(app);
    const viewer = await signUpTestUser(app);

    await uploadRealAvatar(owner);

    // `viewer` has never shared a workspace with `owner` - no
    // WorkspaceMember row links them at all - and the request still
    // succeeds, confirming no workspace-membership check gates this route.
    await request(app)
      .get(`/api/v1/users/${owner.userId}/avatar`)
      .set("Cookie", viewer.cookie)
      .expect(200);
  });

  it("returns 404 with the standard NotFoundError shape for a user with no avatar", async () => {
    const owner = await signUpTestUser(app);
    const viewer = await signUpTestUser(app);

    const res = await request(app)
      .get(`/api/v1/users/${owner.userId}/avatar`)
      .set("Cookie", viewer.cookie)
      .expect(404);

    expect(res.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Avatar not found.",
      },
    });
  });

  it("returns the same 404 body for a nonexistent user as for a real user with no avatar", async () => {
    const viewer = await signUpTestUser(app);

    const res = await request(app)
      .get(`/api/v1/users/${crypto.randomUUID()}/avatar`)
      .set("Cookie", viewer.cookie)
      .expect(404);

    expect(res.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Avatar not found.",
      },
    });
  });

  it("returns 401 for an unauthenticated request", async () => {
    const owner = await signUpTestUser(app);

    const res = await request(app).get(`/api/v1/users/${owner.userId}/avatar`).expect(401);

    expect(res.body.success).toBe(false);
  });

  it("still serves the caller's own avatar via GET /me/avatar unchanged", async () => {
    const owner = await signUpTestUser(app);
    const content = "me avatar probe";

    await uploadRealAvatar(owner, content);

    const res = await request(app)
      .get("/api/v1/users/me/avatar")
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.body).toEqual(Buffer.from(content));
  });
});

// Security regression coverage for the avatar storage-key IDOR: Better
// Auth's generic POST /api/auth/update-user endpoint accepts any `image`
// string with no ownership/format validation and persists it directly onto
// the caller's own User.image (see update-user.mjs). Because getAvatar()/
// deleteAvatar() (user.service.ts) trust User.image on the caller's own
// record as an opaque storage key, an attacker who learns another user's
// real storage key (routinely exposed via workspace member lists, comments,
// activity, attachments - see the corresponding service files' `image`
// serialization) can plant it onto their own account and then use their own
// /me/avatar GET/DELETE to read or destroy that victim's file. These tests
// currently FAIL against the unpatched endpoint and are expected to pass
// once a Better Auth hook rejects a client-supplied `image` on update-user.
describe("Avatar storage-key authorization (update-user IDOR)", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("rejects a client-supplied image value on the generic profile-update endpoint", async () => {
    const user = await signUpTestUser(app);

    const res = await request(app)
      .post("/api/auth/update-user")
      .set("Cookie", user.cookie)
      .send({ image: "users/some-other-user-id/avatar/planted.png" });

    expect(res.status).toBe(400);

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { image: true },
    });
    expect(dbUser.image).toBeNull();
  });

  it("does not allow reading another user's avatar file via a planted image value", async () => {
    const victim = await signUpTestUser(app);
    const attacker = await signUpTestUser(app);
    const content = "victim avatar bytes - must stay private";

    await uploadRealAvatar(victim, content);

    const victimRecord = await prisma.user.findUniqueOrThrow({
      where: { id: victim.userId },
      select: { image: true },
    });
    const victimStorageKey = victimRecord.image;
    expect(victimStorageKey).toBeTruthy();

    await request(app)
      .post("/api/auth/update-user")
      .set("Cookie", attacker.cookie)
      .send({ image: victimStorageKey });

    // The attacker never uploaded their own avatar - if the planted key had
    // ever been accepted, this would return 200 with the victim's bytes
    // instead of 404.
    const res = await request(app)
      .get("/api/v1/users/me/avatar")
      .set("Cookie", attacker.cookie);

    expect(res.status).toBe(404);
  });

  it("does not allow deleting another user's avatar file via a planted image value", async () => {
    const victim = await signUpTestUser(app);
    const attacker = await signUpTestUser(app);
    const content = "victim avatar bytes - must survive the attack";

    await uploadRealAvatar(victim, content);

    const victimRecord = await prisma.user.findUniqueOrThrow({
      where: { id: victim.userId },
      select: { image: true },
    });
    const victimStorageKey = victimRecord.image;

    await request(app)
      .post("/api/auth/update-user")
      .set("Cookie", attacker.cookie)
      .send({ image: victimStorageKey });

    await request(app)
      .delete("/api/v1/users/me/avatar")
      .set("Cookie", attacker.cookie);

    // The victim's real avatar must still be intact and servable afterward.
    const res = await request(app)
      .get(`/api/v1/users/${victim.userId}/avatar`)
      .set("Cookie", victim.cookie)
      .expect(200);

    expect(res.body).toEqual(Buffer.from(content));
  });

  it("still allows legitimate profile updates such as changing name", async () => {
    const user = await signUpTestUser(app);

    await request(app)
      .post("/api/auth/update-user")
      .set("Cookie", user.cookie)
      .send({ name: "Updated Name" })
      .expect(200);

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { name: true },
    });
    expect(dbUser.name).toBe("Updated Name");
  });

  it("still allows a user to delete their own avatar through the normal flow", async () => {
    const user = await signUpTestUser(app);

    await uploadRealAvatar(user, "self avatar bytes");

    await request(app)
      .delete("/api/v1/users/me/avatar")
      .set("Cookie", user.cookie)
      .expect(204);

    await request(app)
      .get("/api/v1/users/me/avatar")
      .set("Cookie", user.cookie)
      .expect(404);
  });
});
