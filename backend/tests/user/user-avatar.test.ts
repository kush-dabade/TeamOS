import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";

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
