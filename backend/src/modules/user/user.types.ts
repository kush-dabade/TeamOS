export interface AvatarStreamResponse {
  stream: NodeJS.ReadableStream;

  mimeType: string;

  size: number;
}
