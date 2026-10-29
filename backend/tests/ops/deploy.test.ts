import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Exercises scripts/ops/deploy.sh, run-deploy.sh and check-migrations.sh
// end to end against a real git repository (a bare "origin" plus a detached
// production checkout) and a fake host: docker/compose, curl, psql and sudo
// are tests/ops/support/fake-host.mjs, which keeps registry images, running
// containers and the migration table in one JSON state file. Nothing here
// talks to a real Docker daemon, registry, database or Azure.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const OPS_DIR = path.join(REPO_ROOT, "scripts/ops");
const DEPLOY = path.join(OPS_DIR, "deploy.sh");
const RUN_DEPLOY = path.join(OPS_DIR, "run-deploy.sh");
const CHECK_MIGRATIONS = path.join(OPS_DIR, "check-migrations.sh");
const FAKE_HOST = path.join(HERE, "support/fake-host.mjs");

const ORIGIN_URL = "https://github.com/example/TeamOS.git";
const SOURCE_URL = "https://github.com/example/TeamOS";
const REGISTRY = "ghcr.io/example";
const PUBLIC_ORIGIN = "https://teamos.example.test";
const SECRET = "redis-secret-value-123";
const INIT = "20260101000000_init";

type Image = { labels: Record<string, string>; migrations: string[]; sql: Record<string, string> };
type Container = { image: string; status: string; health?: string; restarts?: number; exitCode?: number };
type HostState = {
  registry: Record<string, string>;
  images: Record<string, Image>;
  tags: Record<string, string>;
  containers: Record<string, Container>;
  db: { applied: string[]; failed: string[] };
  unhealthy: string[];
  failMigrate: string[];
  calls: string[];
  dbDown?: boolean;
};

let dir: string;
let checkout: string;
const commits: Record<string, string> = {};

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, env: gitEnv(), encoding: "utf8" }).trim();
}

function gitEnv() {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: path.join(dir, "gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
  };
}

function readState(): HostState {
  return JSON.parse(readFileSync(path.join(dir, "state.json"), "utf8"));
}

function updateState(change: (state: HostState) => void) {
  const state = readState();
  change(state);
  writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
}

// Registers the backend and web images CI would have published for a commit.
function publish(
  commit: string,
  {
    migrations = [INIT],
    sql = {},
    revision = commits[commit],
    origin = PUBLIC_ORIGIN,
  }: { migrations?: string[]; sql?: Record<string, string>; revision?: string; origin?: string } = {},
) {
  const sha = commits[commit]!;
  const labels = {
    "org.opencontainers.image.revision": revision!,
    "org.opencontainers.image.source": SOURCE_URL,
  };
  updateState((state) => {
    state.images[`sha256:backend-${commit}`] = { labels, migrations, sql };
    state.images[`sha256:web-${commit}`] = {
      labels: { ...labels, "teamos.public-origin": origin },
      migrations: [],
      sql: {},
    };
    state.registry[`${REGISTRY}/teamos-backend:${sha}`] = `sha256:backend-${commit}`;
    state.registry[`${REGISTRY}/teamos-web:${sha}`] = `sha256:web-${commit}`;
  });
}

function run(script: string, args: string[], overrides: Record<string, string> = {}) {
  const result = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      ...gitEnv(),
      PATH: `${path.join(dir, "bin")}:${process.env.PATH}`,
      HOME: dir,
      FAKE_STATE: path.join(dir, "state.json"),
      OPS_REPO_DIR: checkout,
      OPS_ENV_FILE: path.join(dir, ".env.production"),
      OPS_LOG: path.join(dir, "ops.log"),
      OPS_STATE_DIR: path.join(dir, "state"),
      OPS_RELEASE_LOG: path.join(dir, "releases.log"),
      OPS_DEPLOY_DIAG_DIR: path.join(dir, "deploys"),
      OPS_LOCAL_POSTGRES: "1",
      POSTGRES_USER: "teamos",
      POSTGRES_DB: "teamos",
      TEAMOS_BACKUP_SCRIPT: path.join(dir, "bin", "backup-stub"),
      DEPLOY_HEALTH_TIMEOUT: "0",
      DEPLOY_HEALTH_INTERVAL: "0",
      DEPLOY_HEALTH_PASSES: "1",
      ...overrides,
    },
  });
  const output = result.stdout + result.stderr;
  const result_line = /TEAMOS_DEPLOY_RESULT=(\S+)/.exec(result.stdout.trim().split("\n").pop() ?? "");

  return { status: result.status, output, result: result_line?.[1] };
}

const deploy = (args: string[], overrides?: Record<string, string>) => run(DEPLOY, args, overrides);

function running(service: string) {
  return readState().containers[service]?.image;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "deploy-"));
  mkdirSync(path.join(dir, "bin"));
  for (const tool of ["docker", "curl", "psql", "sudo"]) {
    copyFileSync(FAKE_HOST, path.join(dir, "bin", tool));
    chmodSync(path.join(dir, "bin", tool), 0o755);
  }
  writeFileSync(
    path.join(dir, "bin", "backup-stub"),
    `#!/usr/bin/env bash\necho backup >> "${dir}/backups.log"\nexit "\${STUB_BACKUP_EXIT:-0}"\n`,
  );
  chmodSync(path.join(dir, "bin", "backup-stub"), 0o755);
  writeFileSync(
    path.join(dir, ".env.production"),
    `PUBLIC_ORIGIN=${PUBLIC_ORIGIN}\nPOSTGRES_PASSWORD=${SECRET}\nREDIS_PASSWORD="${SECRET}"\n`,
  );

  // origin (bare) <- seed, with the real ops scripts committed in it so
  // run-deploy.sh can extract them; "side" is a branch that never reached main.
  const origin = path.join(dir, "origin.git");
  writeFileSync(
    path.join(dir, "gitconfig"),
    `[user]\n\tname = Test\n\temail = test@example.test\n[init]\n\tdefaultBranch = main\n` +
      `[url "${origin}"]\n\tinsteadOf = ${ORIGIN_URL}\n[advice]\n\tdetachedHead = false\n`,
  );
  execFileSync("git", ["init", "--bare", "--quiet", origin], { env: gitEnv() });
  const seed = path.join(dir, "seed");
  mkdirSync(path.join(seed, "scripts"), { recursive: true });
  cpSync(OPS_DIR, path.join(seed, "scripts/ops"), { recursive: true });
  writeFileSync(path.join(seed, "docker-compose.prod.yml"), "name: teamos-prod\n");
  git(seed, "init", "--quiet");
  for (const name of ["c1", "c2", "c3", "c4"]) {
    writeFileSync(path.join(seed, "RELEASE"), `${name}\n`);
    git(seed, "add", ".");
    git(seed, "commit", "--quiet", "-m", name);
    commits[name] = git(seed, "rev-parse", "HEAD");
  }
  git(seed, "remote", "add", "origin", ORIGIN_URL);
  git(seed, "push", "--quiet", "origin", "main");
  git(seed, "switch", "--quiet", "-c", "side", commits.c1!);
  writeFileSync(path.join(seed, "RELEASE"), "side\n");
  // An unreviewed branch's deploy logic: it must never be executed.
  writeFileSync(
    path.join(seed, "scripts/ops/deploy.sh"),
    `#!/usr/bin/env bash\ntouch "${dir}/side-branch-code-ran"\n`,
  );
  git(seed, "commit", "--quiet", "-am", "side");
  commits.side = git(seed, "rev-parse", "HEAD");
  git(seed, "push", "--quiet", "origin", "side");

  // Production: a detached checkout of c1, running images built on the VM
  // before this pipeline existed (no revision labels).
  checkout = path.join(dir, "TeamOS");
  git(dir, "clone", "--quiet", ORIGIN_URL, checkout);
  git(checkout, "checkout", "--quiet", "--detach", commits.c1!);

  const live = (image: string): Container => ({ image, status: "running", health: "healthy", restarts: 0 });
  const state: HostState = {
    registry: {},
    images: {
      "sha256:local-backend": { labels: {}, migrations: [INIT], sql: {} },
      "sha256:local-web": { labels: {}, migrations: [], sql: {} },
      "sha256:postgres": { labels: {}, migrations: [], sql: {} },
    },
    tags: { "teamos-backend:prod": "sha256:local-backend", "teamos-web:prod": "sha256:local-web" },
    containers: {
      migrate: { image: "sha256:local-backend", status: "exited", exitCode: 0 },
      backend: live("sha256:local-backend"),
      worker: live("sha256:local-backend"),
      caddy: live("sha256:local-web"),
      postgres: live("sha256:postgres"),
      redis: live("sha256:postgres"),
    },
    db: { applied: [INIT], failed: [] },
    unhealthy: [],
    failMigrate: [],
    calls: [],
  };
  writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("deploy.sh", { timeout: 60_000 }, () => {
  it.each([
    ["an abbreviated SHA", "3d9c640"],
    ["an uppercase SHA", "3D9C640742CCE2EE4A1B8967299EB7714F67C38E"],
    ["a branch name", "main"],
  ])("rejects %s before doing anything", (_label, arg) => {
    const { status, result } = deploy([arg]);

    expect(result).toBe("rejected");
    expect(status).toBe(1);
    expect(readState().calls).toEqual([]);
  });

  it("deploys a newer release: pulls, retags :prod, moves the checkout and records it", () => {
    publish("c2");

    const { status, result, output } = deploy([commits.c2!]);

    expect(output).toContain(`TEAMOS_DEPLOY_RESULT=success sha=${commits.c2} previous=${commits.c1}`);
    expect(result).toBe("success");
    expect(status).toBe(0);
    const state = readState();
    expect(state.tags["teamos-backend:prod"]).toBe("sha256:backend-c2");
    expect(state.tags["teamos-web:prod"]).toBe("sha256:web-c2");
    expect(state.containers.worker!.image).toBe("sha256:backend-c2");
    // The pre-pipeline release stays restorable under its release name.
    expect(state.tags[`teamos-backend:release-${commits.c1}`]).toBe("sha256:local-backend");
    expect(git(checkout, "rev-parse", "HEAD")).toBe(commits.c2);
    expect(readFileSync(path.join(dir, "state/current-release"), "utf8").trim()).toBe(commits.c2);
    const log = readFileSync(path.join(dir, "releases.log"), "utf8");
    expect(log).toMatch(new RegExp(`baseline sha=${commits.c1} `));
    expect(log).toMatch(new RegExp(`success sha=${commits.c2} previous=${commits.c1} backend=${REGISTRY}/teamos-backend@sha256:`));
    expect(readFileSync(path.join(dir, "backups.log"), "utf8")).toBe("backup\n");
  });

  it("redeploys the live release idempotently", () => {
    publish("c2");
    expect(deploy([commits.c2!]).result).toBe("success");

    const again = deploy([commits.c2!]);

    expect(again.result).toBe("success");
    expect(running("backend")).toBe("sha256:backend-c2");
  });

  it("refuses to let an older release overwrite a newer live one, unless asked to", () => {
    publish("c2");
    publish("c3");
    expect(deploy([commits.c3!]).result).toBe("success");
    updateState((state) => {
      state.calls = [];
    });

    const stale = deploy([commits.c2!]);
    expect(stale.result).toBe("stale");
    expect(stale.status).toBe(4);
    expect(readState().calls.some((call) => call.startsWith("docker pull"))).toBe(false);
    expect(running("backend")).toBe("sha256:backend-c3");

    const rollback = deploy(["--allow-older", commits.c2!]);
    expect(rollback.result).toBe("success");
    expect(running("backend")).toBe("sha256:backend-c2");
  });

  it("only deploys commits that are on origin/main", () => {
    const { result, output } = deploy([commits.side!]);

    expect(result).toBe("rejected");
    expect(output).toContain("not a commit on origin/main");
  });

  it("allows one deployment at a time", async () => {
    mkdirSync(path.join(dir, "state"));
    const holder = spawn("flock", [path.join(dir, "state/deploy.lock"), "sleep", "5"]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      publish("c2");
      const { result, output } = deploy([commits.c2!]);

      expect(result).toBe("rejected");
      expect(output).toContain("another deployment is in progress");
      expect(running("backend")).toBe("sha256:local-backend");
    } finally {
      holder.kill();
    }
  });

  it.each([
    ["is not published", () => {}, "could not pull"],
    ["carries the wrong revision label", () => publish("c2", { revision: commits.c1! }), "org.opencontainers.image.revision"],
    ["was built for another origin", () => publish("c2", { origin: "https://other.example.test" }), "was built for"],
  ])("rejects a release whose image %s, without changing anything", (_label, setup, message) => {
    setup();

    const { result, output } = deploy([commits.c2!]);

    expect(result).toBe("rejected");
    expect(output).toContain(message);
    expect(readState().tags["teamos-backend:prod"]).toBe("sha256:local-backend");
    expect(git(checkout, "rev-parse", "HEAD")).toBe(commits.c1);
    expect(existsSync(path.join(dir, "backups.log"))).toBe(false);
  });

  it("aborts before any change when the pre-deployment backup fails", () => {
    publish("c2");

    const { result, output } = deploy([commits.c2!], { STUB_BACKUP_EXIT: "1" });

    expect(result).toBe("rejected");
    expect(output).toContain("pre-deployment backup failed");
    expect(running("backend")).toBe("sha256:local-backend");
  });

  it("rolls back to the previous release when the new one fails its health gate", () => {
    publish("c2");
    updateState((state) => state.unhealthy.push("sha256:backend-c2"));

    const { status, result, output } = deploy([commits.c2!]);

    expect(result).toBe("rolled_back");
    expect(status).toBe(2);
    expect(output).toContain("backend: running exit=0 health=unhealthy");
    const state = readState();
    expect(state.tags["teamos-backend:prod"]).toBe("sha256:local-backend");
    expect(state.containers.backend!.image).toBe("sha256:local-backend");
    expect(git(checkout, "rev-parse", "HEAD")).toBe(commits.c1);
    expect(existsSync(path.join(dir, "state/current-release"))).toBe(false);
    expect(readFileSync(path.join(dir, "releases.log"), "utf8")).toContain(`rolled_back sha=${commits.c2}`);
    // Container logs stay on the host, never in the (public) workflow output.
    expect(output).not.toContain("fake container logs");
    const [diagnostics] = readdirSync(path.join(dir, "deploys"));
    expect(readFileSync(path.join(dir, "deploys", diagnostics!), "utf8")).toContain("fake container logs");
  });

  it("keeps expand migrations applied when it rolls the application back", () => {
    const add = "20260201000000_add_task_color";
    publish("c2", {
      migrations: [INIT, add],
      sql: { [add]: 'ALTER TABLE "Task" ADD COLUMN "color" TEXT;\n' },
    });
    updateState((state) => state.unhealthy.push("sha256:backend-c2"));

    const { result } = deploy([commits.c2!]);

    expect(result).toBe("rolled_back");
    expect(readState().db.applied).toContain(add);
    expect(running("backend")).toBe("sha256:local-backend");
  });

  it("stops for a human when a migration fails, leaving the previous release serving", () => {
    const add = "20260201000000_add_task_color";
    publish("c2", {
      migrations: [INIT, add],
      sql: { [add]: 'ALTER TABLE "Task" ADD COLUMN "color" TEXT;\n' },
    });
    updateState((state) => state.failMigrate.push("sha256:backend-c2"));

    const { status, result, output } = deploy([commits.c2!]);

    expect(result).toBe("failed");
    expect(status).toBe(3);
    expect(output).toContain(`migration failed: ${add}`);
    const state = readState();
    expect(state.containers.backend!.image).toBe("sha256:local-backend");
    expect(state.tags["teamos-backend:prod"]).toBe("sha256:local-backend");
    expect(git(checkout, "rev-parse", "HEAD")).toBe(commits.c1);

    // Prisma won't apply anything else until the failure is resolved.
    const retry = deploy([commits.c2!]);
    expect(retry.result).toBe("rejected");
    expect(retry.output).toContain("a previous migration failed and must be resolved first");
  });

  it("refuses unmarked destructive migrations before taking a backup", () => {
    const drop = "20260201000000_drop_task_color";
    publish("c2", {
      migrations: [INIT, drop],
      sql: { [drop]: 'ALTER TABLE "Task" DROP COLUMN "color";\n' },
    });

    const { result, output } = deploy([commits.c2!]);

    expect(result).toBe("rejected");
    expect(output).toContain("unsafe migration(s)");
    expect(output).toContain(`${drop}.sql`);
    expect(existsSync(path.join(dir, "backups.log"))).toBe(false);
  });

  it("applies contract migrations only by hand, and never rolls back past them", () => {
    const drop = "20260201000000_drop_task_color";
    publish("c2", {
      migrations: [INIT, drop],
      sql: { [drop]: '-- teamos-migration: contract\nALTER TABLE "Task" DROP COLUMN "color";\n' },
    });

    const automatic = deploy([commits.c2!]);
    expect(automatic.result).toBe("rejected");
    expect(automatic.output).toContain("only applied by hand with --allow-contract");

    updateState((state) => state.unhealthy.push("sha256:backend-c2"));
    const manual = deploy(["--allow-contract", commits.c2!]);
    expect(manual.result).toBe("failed");
    expect(manual.output).toContain("contract migration(s) applied");
    expect(running("backend")).toBe("sha256:backend-c2");
  });

  it("verifies the live release, and reports a mismatch as unhealthy", () => {
    publish("c2");
    expect(deploy([commits.c2!]).result).toBe("success");

    const live = deploy(["--verify"]);
    expect(live.result).toBe("verified");
    expect(live.output).toContain(`sha=${commits.c2}`);

    const wrong = deploy(["--verify", commits.c3!]);
    expect(wrong.result).toBe("unhealthy");
    expect(wrong.status).toBe(3);
  });

  it("preflight reports readiness without changing anything", () => {
    const { result, output } = deploy(["--preflight"]);

    expect(result).toBe("ready");
    expect(output).toContain(`sha=${commits.c4} previous=${commits.c1}`);
    expect(readState().calls.every((call) => !/^docker (pull|tag|compose .* up)/.test(call))).toBe(true);
  });

  it("keeps the current and two previous known-good releases", () => {
    for (const name of ["c2", "c3", "c4"]) {
      publish(name);
      expect(deploy([commits[name]!]).result).toBe("success");
    }

    const releaseTags = Object.keys(readState().tags)
      .filter((tag) => tag.startsWith("teamos-backend:release-"))
      .map((tag) => tag.replace("teamos-backend:release-", ""))
      .sort();

    expect(releaseTags).toEqual([commits.c2, commits.c3, commits.c4].sort());
    expect(readState().tags[`${REGISTRY}/teamos-backend:${commits.c2}`]).toBeDefined();
    expect(readState().tags[`${REGISTRY}/teamos-backend:${commits.c1}`]).toBeUndefined();
  });

  it("never puts secrets from the env file into its output or the operations log", () => {
    publish("c2");
    updateState((state) => state.unhealthy.push("sha256:backend-c2"));

    const { output } = deploy([commits.c2!]);

    expect(output).not.toContain(SECRET);
    expect(readFileSync(path.join(dir, "ops.log"), "utf8")).not.toContain(SECRET);
    expect(readState().calls.join("\n")).not.toContain(SECRET);
  });
});

describe("run-deploy.sh", { timeout: 60_000 }, () => {
  const asDeployUser = () => ({ TEAMOS_DEPLOY_USER: userInfo().username, TEAMOS_DEPLOY_DIR: checkout });

  it.each([
    [["deploy"]],
    [["deploy", "abc123"]],
    [["preflight", "a".repeat(40)]],
    [["restart", "a".repeat(40)]],
  ])("rejects %j before switching user", (args) => {
    const { status, result } = run(RUN_DEPLOY, args, asDeployUser());

    expect(result).toBe("rejected");
    expect(status).toBe(1);
    expect(readState().calls).toEqual([]);
  });

  it("never executes code from a commit that is not on origin/main", () => {
    const { status, result, output } = run(RUN_DEPLOY, ["deploy", commits.side!], asDeployUser());

    expect(result).toBe("rejected");
    expect(status).toBe(1);
    expect(output).toContain("is not a commit on origin/main");
    expect(existsSync(path.join(dir, "side-branch-code-ran"))).toBe(false);
  });

  it("runs the requested release's own deploy.sh against the production checkout", () => {
    publish("c2");

    const { status, result } = run(RUN_DEPLOY, ["deploy", commits.c2!], asDeployUser());

    expect(result).toBe("success");
    expect(status).toBe(0);
    expect(readState().calls[0]).toMatch(/^sudo -u \S+ -H -- bash -s -- deploy [0-9a-f]{40} /);
    expect(git(checkout, "rev-parse", "HEAD")).toBe(commits.c2);
  });

  it("verifies through origin/main's scripts without needing a SHA", () => {
    publish("c2");
    expect(run(RUN_DEPLOY, ["deploy", commits.c2!], asDeployUser()).result).toBe("success");

    expect(run(RUN_DEPLOY, ["verify"], asDeployUser()).result).toBe("verified");
    expect(run(RUN_DEPLOY, ["preflight"], asDeployUser()).result).toBe("ready");
  });
});

describe("check-migrations.sh", () => {
  function classify(sql: string) {
    const file = path.join(dir, "migration.sql");
    writeFileSync(file, sql);
    return spawnSync("bash", [CHECK_MIGRATIONS, file], { encoding: "utf8" });
  }

  it.each([
    ['ALTER TABLE "Task" ADD COLUMN "color" TEXT;', "expand"],
    ['CREATE INDEX "Task_color_idx" ON "Task"("color");', "expand"],
    ['DROP INDEX CONCURRENTLY "Sprint_search_idx";', "expand"],
    ["ALTER TYPE \"ActivityType\" ADD VALUE 'TASK_DELETED';", "expand"],
    ['-- dropping nothing, DROP TABLE only appears in this comment\nSELECT 1;', "expand"],
    ['ALTER TABLE "Task" DROP COLUMN "color";', "unsafe"],
    ['DROP TABLE "Legacy";', "unsafe"],
    ['ALTER TABLE "Task" RENAME COLUMN "color" TO "colour";', "unsafe"],
    ['ALTER TABLE "Task" ALTER COLUMN "color" SET NOT NULL;', "unsafe"],
    ['ALTER TABLE "Task" ALTER COLUMN "points" SET DATA TYPE BIGINT;', "unsafe"],
    ['DELETE FROM "Notification";', "unsafe"],
    ['-- teamos-migration: contract\nALTER TABLE "Task" DROP COLUMN "color";', "contract"],
  ])("classifies %j as %s", (sql, expected) => {
    const { stdout, status } = classify(`${sql}\n`);

    expect(stdout.split(" ")[0]).toBe(expected);
    expect(status).toBe(expected === "unsafe" ? 1 : 0);
  });

  it("classifies every migration already in the repository as expand", () => {
    const migrations = path.join(REPO_ROOT, "backend/prisma/migrations");
    const files = readdirSync(migrations, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(migrations, entry.name, "migration.sql"));

    const { stdout, status } = spawnSync("bash", [CHECK_MIGRATIONS, ...files], { encoding: "utf8" });

    expect(stdout.trim().split("\n").filter((line) => !line.startsWith("expand "))).toEqual([]);
    expect(status).toBe(0);
  });
});
