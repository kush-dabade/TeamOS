import { describe, expect, it } from "vitest";

import { ALLOWED_ATTACHMENT_MIME_TYPES } from "../../src/modules/attachment/attachment.config.js";
import { ALLOWED_AVATAR_MIME_TYPES } from "../../src/modules/user/user.config.js";
import { matchesDeclaredFileType } from "../../src/storage/utils/file-signature.js";

const SAMPLES: Record<string, Buffer> = {
  "application/pdf": Buffer.from("%PDF-1.4\n%%EOF\n"),
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  "image/webp": Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]),
  "application/zip": Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  "text/plain": Buffer.from("Release notes - naïve café ✓\n"),
};

describe("matchesDeclaredFileType", () => {
  it("has a check for every type an upload allowlist accepts", () => {
    for (const mimeType of [...ALLOWED_ATTACHMENT_MIME_TYPES, ...ALLOWED_AVATAR_MIME_TYPES]) {
      expect(SAMPLES[mimeType], mimeType).toBeDefined();
      expect(matchesDeclaredFileType(SAMPLES[mimeType] as Buffer, mimeType), mimeType).toBe(true);
    }
  });

  it.each(Object.keys(SAMPLES))("rejects other formats declared as %s", (mimeType) => {
    for (const [otherType, content] of Object.entries(SAMPLES)) {
      if (otherType === mimeType || (mimeType === "text/plain" && otherType === "application/pdf")) {
        // A PDF header is printable text, so it legitimately passes as text/plain.
        continue;
      }
      expect(matchesDeclaredFileType(content, mimeType), `${otherType} as ${mimeType}`).toBe(false);
    }
  });

  it("rejects an HTML page declared as an image", () => {
    expect(matchesDeclaredFileType(Buffer.from("<html><script>alert(1)</script>"), "image/png")).toBe(
      false,
    );
  });

  it("rejects binary or invalid UTF-8 declared as text", () => {
    expect(matchesDeclaredFileType(Buffer.from([0x68, 0x00, 0x69]), "text/plain")).toBe(false);
    expect(matchesDeclaredFileType(Buffer.from([0xc3, 0x28]), "text/plain")).toBe(false);
  });

  it("accepts text whose sample ends mid-character", () => {
    const text = Buffer.from(`${"a".repeat(8191)}é`);
    expect(matchesDeclaredFileType(text, "text/plain")).toBe(true);
  });

  it("rejects truncated and empty files and unknown types", () => {
    expect(matchesDeclaredFileType(Buffer.from([0x89, 0x50]), "image/png")).toBe(false);
    expect(matchesDeclaredFileType(Buffer.alloc(0), "application/pdf")).toBe(false);
    expect(matchesDeclaredFileType(Buffer.from("%PDF-1.4"), "application/x-unknown")).toBe(false);
  });
});
