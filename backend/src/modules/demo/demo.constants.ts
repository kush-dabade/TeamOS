// 2-4h is the agreed target window (long enough for a real evaluator to
// explore without rushing, short enough that abandoned demo workspaces
// don't linger); 3h sits in the middle. A single named constant, not a
// scattered literal, so demo.service.ts (sets it) and
// demo-cleanup.service.ts (queries against it) can never drift apart.
export const DEMO_SESSION_TTL_HOURS = 3;

// RFC 6761 reserves .local for exactly this - an address that can never
// resolve to (or collide with) a real mailbox. Matches the existing local
// dev seed's convention (prisma/seed.ts's DEMO_EMAIL), but every call here
// gets its own random UUID local-part: unlike the local seed's single
// fixed idempotent account, a public visitor needs a genuinely unique
// identity every time (User.email is unique), and concurrent visitors must
// never collide.
const DEMO_EMAIL_DOMAIN = "teamos.local";

export function generateDemoEmail(): string {
  return `demo-${crypto.randomUUID()}@${DEMO_EMAIL_DOMAIN}`;
}
