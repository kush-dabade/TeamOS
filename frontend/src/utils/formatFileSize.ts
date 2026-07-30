const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;

  let rounded = Number(value.toFixed(value < 10 ? 1 : 0));
  let unitIndex = exponent;

  // Rounding can push a value like 1023.96 up to 1024, which belongs in the
  // next unit instead (e.g. "1 MB", not "1024 KB").
  if (rounded >= 1024 && unitIndex < UNITS.length - 1) {
    unitIndex += 1;
    rounded = Number((rounded / 1024).toFixed(1));
  }

  return `${rounded} ${UNITS[unitIndex]}`;
}
