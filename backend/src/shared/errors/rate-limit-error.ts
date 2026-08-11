export class RateLimitError extends Error {
  constructor(
    message = "Too many requests",
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}
