import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Exercises scripts/ops/ops-check.sh end to end with `docker` and `curl`
// replaced by stubs on PATH - the real ones would need the production
// compose stack. The stubs answer exactly the commands the script runs and
// record their own argv, so the test can also prove secrets stay off
// command lines.

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/ops/ops-check.sh",
);
const REDIS_PASSWORD = "redis-secret-value-123";

const DOCKER_STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$STUB_DIR/docker-argv.log"
case "$*" in
  *" ps -a --format "*) printf '%b' "$STUB_SERVICES" ;;
  *" ps -q redis") echo redis-container-id ;;
  "exec -e REDISCLI_AUTH redis-container-id redis-cli --no-auth-warning ZCARD bull:email:failed")
    [ "$REDISCLI_AUTH" = "$EXPECTED_REDIS_PASSWORD" ] || { echo "wrong auth" >&2; exit 1; }
    echo "$STUB_EMAIL_FAILED" ;;
  *) echo "unexpected docker call: $*" >&2; exit 2 ;;
esac
`;

const CURL_STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$STUB_DIR/curl-argv.log"
exit "$STUB_READY_EXIT"
`;

const HEALTHY_SERVICES =
  "backend running healthy\\ncaddy running healthy\\nmigrate exited \\npostgres running healthy\\nredis running healthy\\nworker running healthy\\n";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ops-check-"));
  mkdirSync(path.join(dir, "bin"));
  mkdirSync(path.join(dir, "backups"));
  writeFileSync(path.join(dir, "bin", "docker"), DOCKER_STUB);
  writeFileSync(path.join(dir, "bin", "curl"), CURL_STUB);
  chmodSync(path.join(dir, "bin", "docker"), 0o755);
  chmodSync(path.join(dir, "bin", "curl"), 0o755);
  writeFileSync(
    path.join(dir, ".env.production"),
    `PUBLIC_ORIGIN=https://teamos.example.test\nREDIS_PASSWORD="${REDIS_PASSWORD}"\n`,
  );
  writeBackup(2);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeBackup(ageHours: number) {
  const file = path.join(dir, "backups", "teamos-db-20261028T000000Z.dump");
  writeFileSync(file, "dump");
  const mtime = new Date(Date.now() - ageHours * 3_600_000);
  utimesSync(file, mtime, mtime);
}

function run(overrides: Record<string, string> = {}) {
  const result = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      PATH: `${path.join(dir, "bin")}:${process.env.PATH}`,
      HOME: dir,
      STUB_DIR: dir,
      STUB_SERVICES: HEALTHY_SERVICES,
      STUB_EMAIL_FAILED: "33",
      STUB_READY_EXIT: "0",
      EXPECTED_REDIS_PASSWORD: REDIS_PASSWORD,
      OPS_ENV_FILE: path.join(dir, ".env.production"),
      OPS_LOG: path.join(dir, "ops.log"),
      OPS_STATE_DIR: path.join(dir, "state"),
      BACKUP_DIR: path.join(dir, "backups"),
      // Keep resource checks quiet regardless of the machine running this.
      MEM_MIN_AVAILABLE_MB: "0",
      DISK_MAX_USED_PERCENT: "100",
      ...overrides,
    },
  });

  return { status: result.status, output: result.stdout + result.stderr };
}

describe("ops-check.sh", () => {
  it("passes when everything is healthy, recording the email baseline without alerting", () => {
    const { status, output } = run();

    expect(output).toContain("OK email no new delivery failures (failed set: 33)");
    expect(output).toContain("OK summary all checks passed");
    expect(status).toBe(0);
  });

  it("alerts only on email failures that are new since the previous run", () => {
    expect(run().status).toBe(0);

    const second = run({ STUB_EMAIL_FAILED: "35" });
    expect(second.output).toContain("ALERT email 2 new permanently failed email job(s) (failed set: 35)");
    expect(second.status).toBe(1);

    // Retention trimming shrinks the set; that's not a failure.
    const third = run({ STUB_EMAIL_FAILED: "20" });
    expect(third.status).toBe(0);
  });

  it("alerts on a failing readiness probe, a down service, and a stale backup", () => {
    writeBackup(30);

    const { status, output } = run({
      STUB_READY_EXIT: "22",
      STUB_SERVICES: HEALTHY_SERVICES.replace("worker running healthy", "worker exited "),
    });

    expect(output).toContain("ALERT readiness");
    expect(output).toContain("ALERT services not running or unhealthy: worker(exited)");
    expect(output).toMatch(/ALERT backup-age newest backup teamos-db-.*\.dump is 30h old/);
    expect(output).toContain("ALERT summary 3 check(s) need attention");
    expect(status).toBe(1);
  });

  it("ignores the one-shot migrate service having exited", () => {
    const { output } = run();
    expect(output).toContain("OK services all running");
  });

  it("never exposes the Redis password in command lines or the operations log", () => {
    run();

    const recorded = [
      readFileSync(path.join(dir, "docker-argv.log"), "utf8"),
      readFileSync(path.join(dir, "curl-argv.log"), "utf8"),
      readFileSync(path.join(dir, "ops.log"), "utf8"),
    ].join("\n");

    expect(recorded).not.toContain(REDIS_PASSWORD);
  });
});
