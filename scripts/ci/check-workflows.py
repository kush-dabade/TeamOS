#!/usr/bin/env python3
"""Checks the security properties the CI/CD pipeline relies on, across every
workflow and local action under .github/ (see docs/development/deployment.md#releases):

- no pull_request_target, and no workflow without explicit permissions;
- only release.yml's `publish` job may write packages, and only
  release.yml's `deploy` job and production-check.yml may request an OIDC
  token - all three only reachable from main, never from a pull request;
- the deploy job targets the `production` environment, waits for publish,
  and is serialised with production-check by a non-cancelling concurrency
  group;
- workflows a pull request can trigger use no secrets and push nothing;
- every third-party action is pinned to a full commit SHA, and every
  checkout disables credential persistence.

Usage: python3 scripts/ci/check-workflows.py [repository root]
Exits 1 and lists every violation if any rule is broken.
"""

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
ACTIONS = ROOT / ".github" / "actions"
PINNED = re.compile(r"^[^@\s]+@[0-9a-f]{40}$")

problems: list[str] = []


def fail(where: str, message: str) -> None:
    problems.append(f"{where}: {message}")


def load(path: Path) -> dict:
    with path.open() as handle:
        return yaml.safe_load(handle)


def triggers(workflow: dict) -> dict:
    # PyYAML (YAML 1.1) reads an unquoted `on:` key as the boolean True.
    on = workflow.get("on", workflow.get(True))
    if isinstance(on, str):
        return {on: None}
    if isinstance(on, list):
        return {name: None for name in on}
    return on or {}


def steps_of(document: dict) -> list[tuple[str, dict]]:
    if "runs" in document:
        return [("runs", step) for step in document["runs"].get("steps", [])]
    return [(job_id, step) for job_id, job in document.get("jobs", {}).items() for step in job.get("steps", [])]


def check_steps(name: str, document: dict) -> None:
    for job_id, step in steps_of(document):
        uses = step.get("uses")
        if not uses or uses.startswith("./"):
            continue
        if not PINNED.match(uses):
            fail(f"{name} {job_id}", f"action {uses!r} is not pinned to a full commit SHA")
        if uses.startswith("actions/checkout@") and (step.get("with") or {}).get("persist-credentials") is not False:
            fail(f"{name} {job_id}", "actions/checkout without persist-credentials: false")


def permissions_granted(job: dict) -> dict:
    granted = job.get("permissions", {})
    if granted in ("write-all", "read-all"):
        return {"*": granted}
    return granted or {}


workflows = {path.name: load(path) for path in sorted(WORKFLOWS.glob("*.yml"))}
actions = {str(path.relative_to(ROOT)): load(path) for path in sorted(ACTIONS.glob("*/action.yml"))}

if "release.yml" not in workflows or "production-check.yml" not in workflows:
    fail(".github/workflows", "release.yml and production-check.yml must exist")

for name, workflow in workflows.items():
    on = triggers(workflow)
    if "pull_request_target" in on:
        fail(name, "pull_request_target runs with secrets on untrusted code - not allowed")
    if "permissions" not in workflow:
        fail(name, "no top-level permissions (would inherit the repository default)")
    elif workflow["permissions"] in ("write-all",) or any(
        value == "write" for value in (workflow["permissions"] or {}).values()
    ):
        fail(name, "top-level permissions must be read-only; grant writes per job")

    for job_id, job in workflow.get("jobs", {}).items():
        granted = permissions_granted(job)
        if "*" in granted:
            fail(f"{name} {job_id}", f"permissions: {granted['*']} is not allowed")
        if granted.get("packages") == "write" and (name, job_id) != ("release.yml", "publish"):
            fail(f"{name} {job_id}", "only release.yml's publish job may write packages")
        if granted.get("id-token") == "write" and (name, job_id) not in {
            ("release.yml", "deploy"),
            ("production-check.yml", "check"),
        }:
            fail(f"{name} {job_id}", "only the deploy and production-check jobs may request OIDC tokens")

    check_steps(name, workflow)

    # Anything a pull request can start must be unable to publish or deploy.
    if "pull_request" in on:
        # Comments are dropped first, so prose can mention these freely.
        text = "\n".join(line.split(" #")[0] for line in (WORKFLOWS / name).read_text().splitlines()
                         if not line.lstrip().startswith("#"))
        for pattern, why in [
            (r"\$\{\{\s*secrets\.", "uses secrets"),
            (r"docker/login-action", "logs in to a registry"),
            (r"\bpush:\s*true", "pushes images"),
            (r"run-command", "invokes Azure Run Command"),
            (r"actions/vm-run", "runs a release action on the VM"),
            (r"id-token", "requests an OIDC token"),
            (r"^\s*environment:", "targets a deployment environment"),
        ]:
            if re.search(pattern, text, re.MULTILINE):
                fail(name, f"is triggered by pull_request but {why}")

for name, action in actions.items():
    check_steps(name, action)

release = workflows.get("release.yml", {})
if release:
    on = triggers(release)
    if set(on) != {"push"} or (on["push"] or {}).get("branches") != ["main"]:
        fail("release.yml", "must trigger only on push to main")
    jobs = release.get("jobs", {})
    publish = jobs.get("publish", {})
    deploy = jobs.get("deploy", {})
    if set(publish.get("needs", [])) != {"backend", "frontend", "production"}:
        fail("release.yml publish", "must need backend, frontend and production CI")
    if deploy.get("needs") not in ("publish", ["publish"]):
        fail("release.yml deploy", "must need publish")
    environment = deploy.get("environment")
    if (environment or {}).get("name") != "production" and environment != "production":
        fail("release.yml deploy", "must use the production environment")
    concurrency = deploy.get("concurrency") or {}
    if concurrency.get("group") != "production-deploy" or concurrency.get("cancel-in-progress") is not False:
        fail("release.yml deploy", "must use the non-cancelling production-deploy concurrency group")
    for job_id in ("backend", "frontend", "production"):
        if not str(jobs.get(job_id, {}).get("uses", "")).startswith("./.github/workflows/"):
            fail(f"release.yml {job_id}", "must call the repository's own CI workflow")

check = workflows.get("production-check.yml", {})
if check:
    if set(triggers(check)) != {"workflow_dispatch"}:
        fail("production-check.yml", "must only be started by hand (workflow_dispatch)")
    job = check.get("jobs", {}).get("check", {})
    if "refs/heads/main" not in str(job.get("if", "")):
        fail("production-check.yml check", "must only run from main")
    if (job.get("concurrency") or {}).get("group") != "production-deploy":
        fail("production-check.yml check", "must share the production-deploy concurrency group")

if problems:
    print("Workflow policy violations:")
    for problem in problems:
        print(f"  - {problem}")
    sys.exit(1)

print(f"Workflow policy OK ({len(workflows)} workflows, {len(actions)} local actions)")
