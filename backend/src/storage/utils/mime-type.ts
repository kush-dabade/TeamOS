import path from "node:path";

export function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function normalizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

export function getMimeTypeExtension(mimeType: string): string | null {
  switch (normalizeMimeType(mimeType)) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return null;
  }
}