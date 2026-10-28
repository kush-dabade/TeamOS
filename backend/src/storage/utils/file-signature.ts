// The MIME type multer reports comes from the client's multipart headers, so
// on its own it says nothing about what was actually uploaded. These checks
// confirm the bytes match the declared type for every type the attachment
// and avatar allowlists accept - a sanity check on the format, not malware
// scanning. Downloads additionally rely on X-Content-Type-Options: nosniff
// and Content-Disposition (see attachment.controller.ts).

const TEXT_SAMPLE_BYTES = 8192;

function startsWith(content: Buffer, signature: number[], offset = 0): boolean {
  if (content.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => content[offset + index] === byte);
}

function ascii(text: string): number[] {
  return [...text].map((character) => character.charCodeAt(0));
}

function looksLikePlainText(content: Buffer): boolean {
  const sample = content.subarray(0, TEXT_SAMPLE_BYTES);

  if (sample.includes(0)) {
    return false;
  }

  try {
    // `stream: true` tolerates a multi-byte character cut off at the end of
    // the sample; anything else that isn't valid UTF-8 throws.
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

const SIGNATURE_CHECKS: Record<string, (content: Buffer) => boolean> = {
  "application/pdf": (content) => startsWith(content, ascii("%PDF-")),
  "image/jpeg": (content) => startsWith(content, [0xff, 0xd8, 0xff]),
  "image/png": (content) =>
    startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": (content) =>
    startsWith(content, ascii("RIFF")) && startsWith(content, ascii("WEBP"), 8),
  // Local file header, or the end-of-central-directory record that is all an
  // empty archive contains.
  "application/zip": (content) =>
    startsWith(content, [0x50, 0x4b, 0x03, 0x04]) || startsWith(content, [0x50, 0x4b, 0x05, 0x06]),
  "text/plain": looksLikePlainText,
};

/**
 * Whether `content` is plausibly a file of `mimeType`. Unknown types return
 * false, so a type added to an allowlist without a matching check here is
 * rejected rather than silently trusted.
 */
export function matchesDeclaredFileType(content: Buffer, mimeType: string): boolean {
  const check = SIGNATURE_CHECKS[mimeType];

  return check !== undefined && check(content);
}
