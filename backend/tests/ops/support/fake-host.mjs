#!/usr/bin/env node
// A stateful stand-in for the production host's docker (including compose),
// curl, psql and sudo, used by tests/ops/deploy.test.ts. Linked onto PATH
// under each of those names; it reads and writes one JSON state file
// ($FAKE_STATE) so a test can set up registry images, running containers
// and the migration table, run deploy.sh, and inspect what changed.
//
// It answers exactly the command shapes scripts/ops/deploy.sh and
// run-deploy.sh use, and fails loudly on anything else so an unexpected call
// can't pass silently.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const STATE_FILE = process.env.FAKE_STATE;
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);

const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
state.calls.push([tool, ...args].join(" "));

function save() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function exit(code, stdout = "", stderr = "") {
  save();
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(code);
}

function resolveImage(ref) {
  if (state.images[ref]) return ref;
  return state.tags[ref];
}

function containerFor(id) {
  const service = id.replace(/^c-/, "");
  return [service, state.containers[service]];
}

function render(format, values) {
  return format
    .replace(/\{\{index \.Config\.Labels "([^"]+)"\}\}/g, (_m, key) => values.labels?.[key] ?? "<no value>")
    .replace("{{range .RepoDigests}}{{println .}}{{end}}", values.repoDigests ?? "")
    .replace("{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", values.health ?? "none")
    .replaceAll("{{.Id}}", values.id ?? "")
    .replaceAll("{{.Image}}", values.image ?? "")
    .replaceAll("{{.State.Status}}", values.status ?? "")
    .replaceAll("{{.State.ExitCode}}", String(values.exitCode ?? 0))
    .replaceAll("{{.RestartCount}}", String(values.restarts ?? 0));
}

function healthOf(imageId) {
  return state.unhealthy.includes(imageId) ? "unhealthy" : "healthy";
}

function running(service) {
  const container = state.containers[service];
  return container && container.status === "running" ? container : undefined;
}

function compose(composeArgs) {
  // Drop "-f <file> --env-file <file>".
  const rest = [];
  for (let i = 0; i < composeArgs.length; i++) {
    if (composeArgs[i] === "-f" || composeArgs[i] === "--env-file") i++;
    else rest.push(composeArgs[i]);
  }
  const [command, ...options] = rest;

  if (command === "ps") {
    const all = options.includes("-a");
    const service = options.filter((o) => !o.startsWith("-")).pop();
    if (!options.includes("-q")) {
      const table = Object.entries(state.containers)
        .map(([name, c]) => `${name} ${c.status} ${c.health ?? ""}`)
        .join("\n");
      exit(0, `${table}\n`);
    }
    const container = all ? state.containers[service] : running(service);
    exit(0, container ? `c-${service}\n` : "");
  }

  if (command === "logs") exit(0, "fake container logs\n");

  if (command === "up") {
    const backendId = state.tags["teamos-backend:prod"];
    const webId = state.tags["teamos-web:prod"];
    const image = state.images[backendId];

    const pending = image.migrations.filter((m) => !state.db.applied.includes(m));
    if (state.failMigrate.includes(backendId)) {
      state.containers.migrate = { image: backendId, status: "exited", exitCode: 1 };
      state.db.failed.push(pending[0] ?? "unknown_migration");
      exit(1, "", "service \"migrate\" didn't complete successfully: exit 1\n");
    }
    state.db.applied.push(...pending);
    state.containers.migrate = { image: backendId, status: "exited", exitCode: 0 };

    for (const service of ["backend", "worker"]) {
      const current = state.containers[service];
      if (!current || current.image !== backendId || current.status !== "running") {
        state.containers[service] = {
          image: backendId,
          status: "running",
          health: healthOf(backendId),
          restarts: 0,
        };
      }
    }
    if (state.containers.backend.health !== "healthy") {
      exit(1, "", "dependency failed to start: container teamos-prod-backend-1 is unhealthy\n");
    }
    const caddy = state.containers.caddy;
    if (!caddy || caddy.image !== webId || caddy.status !== "running") {
      state.containers.caddy = { image: webId, status: "running", health: healthOf(webId), restarts: 0 };
    }
    exit(0);
  }

  exit(2, "", `fake docker compose: unexpected command: ${rest.join(" ")}\n`);
}

function docker() {
  const [command, ...rest] = args;

  if (command === "compose") return compose(rest);
  if (command === "info") exit(state.dockerDown ? 1 : 0, "fake docker info\n");

  if (command === "image" && rest[0] === "inspect") {
    const format = rest[rest.indexOf("-f") + 1];
    const ref = rest[rest.length - 1];
    const id = resolveImage(ref);
    if (!id) exit(1, "", `Error: No such image: ${ref}\n`);
    const repoDigests = Object.entries(state.registry)
      .filter(([, imageId]) => imageId === id)
      .map(([registryRef]) => `${registryRef.split(":")[0]}@sha256:digest-of-${id.replace("sha256:", "")}\n`)
      .join("");
    exit(0, `${render(format, { id, labels: state.images[id].labels, repoDigests })}\n`);
  }

  if (command === "inspect") {
    const format = rest[rest.indexOf("-f") + 1];
    const [service, container] = containerFor(rest[rest.length - 1]);
    if (!container) exit(1, "", `Error: No such container: c-${service}\n`);
    exit(0, `${render(format, container)}\n`);
  }

  if (command === "pull") {
    const ref = rest[rest.length - 1];
    const id = state.registry[ref];
    if (!id) exit(1, "", `Error response from daemon: manifest unknown: ${ref}\n`);
    state.tags[ref] = id;
    exit(0, `${ref}\n`);
  }

  if (command === "tag") {
    const id = resolveImage(rest[0]);
    if (!id) exit(1, "", `Error: No such image: ${rest[0]}\n`);
    state.tags[rest[1]] = id;
    exit(0);
  }

  if (command === "image" && rest[0] === "rm") {
    for (const ref of rest.slice(1)) delete state.tags[ref];
    exit(0);
  }

  if (command === "image" && rest[0] === "ls") {
    const repo = rest[rest.length - 1];
    const tags = Object.keys(state.tags)
      .filter((ref) => ref.startsWith(`${repo}:`))
      .map((ref) => ref.slice(repo.length + 1));
    exit(0, tags.length ? `${tags.join("\n")}\n` : "");
  }

  if (command === "run") {
    const entrypoint = rest[rest.indexOf("--entrypoint") + 1];
    const imageRef = rest[rest.indexOf("--entrypoint") + 2];
    const image = state.images[resolveImage(imageRef)];
    if (!image) exit(125, "", `Unable to find image '${imageRef}'\n`);
    if (entrypoint === "sh") exit(0, image.migrations.map((m) => `${m}\n`).join(""));
    if (entrypoint === "cat") {
      const name = rest[rest.length - 1].split("/")[2];
      const sql = image.sql[name];
      if (sql === undefined) exit(1, "", `cat: ${rest[rest.length - 1]}: No such file or directory\n`);
      exit(0, sql);
    }
  }

  exit(2, "", `fake docker: unexpected command: ${args.join(" ")}\n`);
}

function curl() {
  const url = new URL(args.filter((a) => /^https?:\/\//.test(a)).pop());
  const discard = args.includes("-o");
  const backend = running("backend");

  if (url.pathname === "/ready") exit(backend?.health === "healthy" && !state.dbDown ? 0 : 22);
  if (url.pathname === "/health") {
    if (!backend) exit(7, "", "curl: (7) Failed to connect\n");
    const revision = state.images[backend.image].labels["org.opencontainers.image.revision"];
    const body = JSON.stringify({
      success: true,
      message: "TeamOS API is running",
      revision: /^[0-9a-f]{40}$/.test(revision ?? "") ? revision : null,
    });
    exit(0, discard ? "" : body);
  }
  if (url.pathname === "/") exit(running("caddy")?.health === "healthy" ? 0 : 22);
  exit(22);
}

function psql() {
  if (state.dbDown) exit(2, "", "psql: error: connection refused\n");
  const sql = readFileSync(0, "utf8");
  if (sql.includes("to_regclass")) exit(0, "t\n");
  if (sql.includes("finished_at IS NOT NULL")) exit(0, state.db.applied.map((m) => `${m}\n`).join(""));
  if (sql.includes("finished_at IS NULL")) exit(0, state.db.failed.map((m) => `${m}\n`).join(""));
  exit(3, "", `fake psql: unexpected query: ${sql}\n`);
}

// sudo -u <user> -H -- <command...>: run the command as ourselves.
function sudo() {
  save();
  const command = args.slice(args.indexOf("--") + 1);
  try {
    execFileSync(command[0], command.slice(1), { stdio: "inherit" });
    process.exit(0);
  } catch (error) {
    process.exit(typeof error.status === "number" ? error.status : 1);
  }
}

({ docker, curl, psql, sudo })[tool]?.() ?? exit(2, "", `fake-host: unknown tool ${tool}\n`);
