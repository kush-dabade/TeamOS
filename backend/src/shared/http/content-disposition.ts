// Anything outside printable ASCII (0x20-0x7E) — including CR/LF and other
// control characters — plus the quoted-string special characters '"' and
// '\', since those would otherwise break the quoted filename parameter or
// (for CR/LF) make Node's res.setHeader() throw ERR_INVALID_CHAR.
const UNSAFE_ASCII_FALLBACK_CHARS = /[^\x20-\x7E]|["\\]/g;

// RFC 5987's attr-char grammar is "token except '*' / \"'\" / '%'", and '('/')'
// aren't valid HTTP token characters either — but encodeURIComponent leaves
// all four of * ' ( ) unescaped. Percent-encode them explicitly so filename*
// is strictly conformant rather than merely "works in lenient parsers."
function encodeRFC5987ValueChars(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildAttachmentContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(UNSAFE_ASCII_FALLBACK_CHARS, "_") || "download";

  // RFC 6266 quoted filename for clients that don't support filename*,
  // paired with the RFC 5987 filename* parameter so UTF-8 filenames are
  // preserved exactly for clients that do.
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987ValueChars(filename)}`;
}
