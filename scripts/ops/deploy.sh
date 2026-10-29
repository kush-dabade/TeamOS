#!/usr/bin/env bash
# Deploys one release - a full commit SHA on origin/main whose images the
# Release workflow published to GHCR - and proves it healthy, or verifies
# the release that is already running. Runs on the VM as the owner of the
# checkout, normally through run-deploy.sh (Azure Run Command from the
# Release workflow). Never builds an image. See
# docs/development/deployment.md#releases.
#
# Usage: scripts/ops/deploy.sh [--allow-older] [--allow-contract] <sha>
#        scripts/ops/deploy.sh --verify [<sha>]
#        scripts/ops/deploy.sh --preflight
#
#   --allow-older     deploy a release older than the live one (manual rollback)
#   --allow-contract  apply pending contract migrations (manual, see check-migrations.sh)
#   --verify          change nothing; check that <sha> (default: the recorded
#                     current release) is what is running, and healthy
#   --preflight       change nothing; check this host is ready to deploy
#
# The last line of output is always one machine-readable result, which the
# Release workflow reads back through Run Command:
#
#   TEAMOS_DEPLOY_RESULT=<result> sha=<sha> previous=<sha|none>
#
#   result       exit  meaning
#   success      0     <sha> is live and passed every health gate
#   verified     0     --verify: <sha> is running and healthy
#   ready        0     --preflight: deployments can run (sha= is origin/main)
#   rejected     1     refused before changing anything (reason logged above)
#   rolled_back  2     <sha> failed its health gate; the previous release is back and healthy
#   failed       3     needs a human: see the diagnostics file named above
#   unhealthy    3     --verify: <sha> is not what is running, or not healthy
#   stale        4     a newer release is already live; nothing changed
#
# Env: DEPLOY_HEALTH_TIMEOUT (300 s), DEPLOY_HEALTH_INTERVAL (5 s),
#      DEPLOY_HEALTH_PASSES (3 consecutive), DEPLOY_KEEP_RELEASES (3 = current
#      plus two previous), OPS_RELEASE_LOG (~/teamos-ops/releases.log),
#      TEAMOS_IMAGE_PREFIX and TEAMOS_SOURCE_URL (default: derived from the
#      checkout's origin URL), TEAMOS_BACKUP_SCRIPT (default: backup.sh here)

# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-300}"
HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-5}"
HEALTH_PASSES="${DEPLOY_HEALTH_PASSES:-3}"
KEEP_RELEASES="${DEPLOY_KEEP_RELEASES:-3}"
RELEASE_LOG="${OPS_RELEASE_LOG:-$HOME/teamos-ops/releases.log}"
DIAG_DIR="${OPS_DEPLOY_DIAG_DIR:-$HOME/teamos-ops/deploys}"
BACKUP_SCRIPT="${TEAMOS_BACKUP_SCRIPT:-$SCRIPT_DIR/backup.sh}"
CURRENT_FILE="$OPS_STATE_DIR/current-release"
LOCK_FILE="$OPS_STATE_DIR/deploy.lock"

# The local names docker-compose.prod.yml runs (`:prod`). Each release is
# also kept as :release-<sha>, which is what a rollback retags from.
LOCAL_BACKEND=teamos-backend
LOCAL_WEB=teamos-web

MODE=deploy
ALLOW_OLDER=0
ALLOW_CONTRACT=0
SHA=""
PREVIOUS=""
SOURCE_URL=""
IMAGE_PREFIX=""
BACKEND_IMAGE=""
WEB_IMAGE=""
BACKEND_REF=""
WEB_REF=""
CHANGED=0
DIAG_FILE=""
WORK_DIR=""
GATE_REASON=""
APPLIED_BEFORE=""
CONTRACT_PENDING=""
PREV_BACKEND_ID=""
PREV_WEB_ID=""

# --- results ---------------------------------------------------------------

finish() { # RESULT EXIT_CODE
  trap - ERR
  printf 'TEAMOS_DEPLOY_RESULT=%s sha=%s previous=%s\n' "$1" "${SHA:-none}" "${PREVIOUS:-none}"
  exit "$2"
}

reject() {
  ops_log ALERT deploy "rejected ${SHA:-<none>}: $*"
  finish rejected 1
}

# Anything unexpected before the first change is a rejection; after it, the
# failure path decides whether rolling back is safe.
on_unexpected_error() {
  trap - ERR
  if [ "$CHANGED" = 1 ]; then
    handle_failure "unexpected error at line $1"
  fi
  reject "unexpected error at line $1"
}
trap 'on_unexpected_error $LINENO' ERR
trap '[ -z "$WORK_DIR" ] || rm -rf "$WORK_DIR"' EXIT

is_sha() { [[ $1 =~ ^[0-9a-f]{40}$ ]]; }

# --- images ----------------------------------------------------------------

image_id() { docker image inspect -f '{{.Id}}' "$1"; }

image_label() { # IMAGE LABEL
  docker image inspect -f "{{index .Config.Labels \"$2\"}}" "$1"
}

repo_digest() { # IMAGE REPOSITORY - the registry digest, or the local id
  local digest
  digest=$(docker image inspect -f '{{range .RepoDigests}}{{println .}}{{end}}' "$1" |
    grep -m 1 "^$2@" || true)
  printf '%s' "${digest:-$(image_id "$1")}"
}

# The image a service's running container was created from, or nothing.
running_image() {
  local id
  id=$(dc ps -q "$1" 2> /dev/null | head -n 1 || true)
  [ -z "$id" ] || docker inspect -f '{{.Image}}' "$id"
}

# --- migrations ------------------------------------------------------------

psql_rows() { # SQL on stdin
  in_postgres 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -AtX -v ON_ERROR_STOP=1 -f -'
}

migration_rows() { # applied|failed
  local where
  case "$1" in
    applied) where='finished_at IS NOT NULL AND rolled_back_at IS NULL' ;;
    failed) where='finished_at IS NULL AND rolled_back_at IS NULL' ;;
  esac
  # A database that has never been migrated has no _prisma_migrations table.
  [ "$(psql_rows <<< "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")" = t ] || return 0
  psql_rows <<< "SELECT migration_name FROM _prisma_migrations WHERE $where ORDER BY 1" | LC_ALL=C sort
}

image_migrations() { # IMAGE
  docker run --rm --network none --entrypoint sh "$1" -c \
    'cd prisma/migrations && for d in */; do [ -f "${d}migration.sql" ] && printf "%s\n" "${d%/}"; done; true' |
    LC_ALL=C sort
}

sorted_lines() { printf '%s\n' "$1" | sed '/^$/d' | LC_ALL=C sort -u; }
lines_only_in() { comm -23 <(sorted_lines "$1") <(sorted_lines "$2"); } # A B: in A, not in B
lines_in_both() { comm -12 <(sorted_lines "$1") <(sorted_lines "$2"); }

# --- health ----------------------------------------------------------------

# One pass over everything that has to be true for a release to count as
# live: migrate finished cleanly, every long-running service is running the
# expected image and reports healthy, and the public origin answers through
# Caddy with the expected revision.
release_healthy() { # BACKEND_ID WEB_ID REVISION CHECK_RESTARTS
  local backend_id=$1 web_id=$2 revision=$3 check_restarts=$4
  local origin svc id image status health restarts expected migrate_state body
  GATE_REASON=""

  id=$(dc ps -a -q migrate 2> /dev/null | head -n 1 || true)
  [ -n "$id" ] || { GATE_REASON="migrate has no container"; return 1; }
  migrate_state=$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$id" || true)
  [ "$migrate_state" = "exited 0" ] ||
    { GATE_REASON="migrate is '$migrate_state', expected 'exited 0'"; return 1; }

  for svc in backend worker caddy postgres redis; do
    id=$(dc ps -q "$svc" 2> /dev/null | head -n 1 || true)
    [ -n "$id" ] || { GATE_REASON="$svc is not running"; return 1; }
    read -r image status health restarts < <(docker inspect -f \
      '{{.Image}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} {{.RestartCount}}' "$id")

    case "$svc" in
      backend | worker) expected=$backend_id ;;
      caddy) expected=$web_id ;;
      *) expected="" ;;
    esac
    if [ -n "$expected" ] && [ "$image" != "$expected" ]; then
      GATE_REASON="$svc runs image $image, expected $expected"
      return 1
    fi
    [ "$status" = running ] && [ "$health" = healthy ] ||
      { GATE_REASON="$svc is $status/$health"; return 1; }
    if [ "$check_restarts" = 1 ] && [ -n "$expected" ] && [ "$restarts" != 0 ]; then
      GATE_REASON="$svc restarted $restarts time(s)"
      return 1
    fi
  done

  origin=$(env_value PUBLIC_ORIGIN)
  curl -fsS --max-time 10 -o /dev/null "$origin/ready" 2> /dev/null ||
    { GATE_REASON="$origin/ready is not answering 200"; return 1; }
  body=$(curl -fsS --max-time 10 "$origin/health" 2> /dev/null) ||
    { GATE_REASON="$origin/health is not answering 200"; return 1; }
  if [ -n "$revision" ] && [[ $body != *"\"revision\":\"$revision\""* ]]; then
    GATE_REASON="$origin/health reports revision $(reported_revision "$body"), expected $revision"
    return 1
  fi
  curl -fsS --max-time 10 -o /dev/null "$origin/" 2> /dev/null ||
    { GATE_REASON="$origin/ (the app through Caddy) is not answering 200"; return 1; }
}

reported_revision() { # HEALTH_BODY
  local found
  found=$(printf '%s' "$1" | grep -oE '"revision":("[0-9a-f]*"|null)' | head -n 1 || true)
  found=${found#\"revision\":}
  printf '%s' "${found:-none}" | tr -d '"'
}

wait_healthy() { # BACKEND_ID WEB_ID REVISION CHECK_RESTARTS
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) passes=0
  while :; do
    if release_healthy "$@"; then
      passes=$((passes + 1))
      [ "$passes" -lt "$HEALTH_PASSES" ] || return 0
    else
      passes=0
    fi
    [ "$SECONDS" -lt "$deadline" ] || return 1
    sleep "$HEALTH_INTERVAL"
  done
}

# --- diagnostics -----------------------------------------------------------

# Printed output ends up in the GitHub Actions log, which is public for this
# repository: only states, exit codes, image ids and revisions go there.
# Container logs can contain user data, so they go to a 0600 file on the VM.
print_state() {
  local svc id origin
  echo "service state:"
  for svc in migrate backend worker caddy postgres redis; do
    id=$(dc ps -a -q "$svc" 2> /dev/null | head -n 1 || true)
    if [ -z "$id" ]; then
      echo "  $svc: no container"
      continue
    fi
    docker inspect -f "  $svc: {{.State.Status}} exit={{.State.ExitCode}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}} image={{.Image}}" "$id" || true
  done
  origin=$(env_value PUBLIC_ORIGIN)
  echo "  revision: expected ${SHA:-none}, /health reports $(reported_revision "$(curl -fsS --max-time 10 "$origin/health" 2> /dev/null || true)")"
}

write_diagnostics() {
  [ -n "$DIAG_FILE" ] || return 0
  {
    echo "== dc ps -a"
    dc ps -a || true
    echo "== dc logs (tail)"
    dc logs --no-color --tail=200 migrate backend worker caddy || true
  } >> "$DIAG_FILE" 2>&1
  echo "full diagnostics (container logs) on the VM: $DIAG_FILE"
}

# --- release records -------------------------------------------------------

record_release() { # OUTCOME SHA BACKEND_REF WEB_REF
  mkdir -p "$(dirname "$RELEASE_LOG")"
  printf '%s %s sha=%s previous=%s backend=%s web=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$1" "$2" "${PREVIOUS:-none}" "$3" "$4" >> "$RELEASE_LOG"
}

# Most recent first, each SHA once: the releases that were live and healthy.
known_good_releases() {
  [ -f "$RELEASE_LOG" ] || return 0
  awk '$2 == "success" || $2 == "baseline" { sub("^sha=", "", $3); print $3 }' "$RELEASE_LOG" |
    tac | awk '!seen[$0]++'
}

# Keeps :release-<sha> (and the pulled registry tag) for the newest
# KEEP_RELEASES known-good releases, removes the rest. Images a container
# still uses can't be removed; docker refuses and that's fine.
prune_releases() {
  local keep repo registry tag sha
  keep=$(known_good_releases | head -n "$KEEP_RELEASES")
  for repo in "$LOCAL_BACKEND" "$LOCAL_WEB"; do
    registry="$IMAGE_PREFIX/$repo"
    while read -r tag; do
      sha=${tag#release-}
      is_sha "$sha" || continue
      grep -qx "$sha" <<< "$keep" && continue
      docker image rm "$repo:$tag" "$registry:$sha" > /dev/null 2>&1 || true
      ops_log OK deploy "pruned $repo release $sha"
    done < <(docker image ls --format '{{.Tag}}' "$repo" | grep '^release-' || true)
  done
}

# --- failure handling ------------------------------------------------------

# Puts the :prod tags and the checkout back on the previous release without
# restarting anything, so a later `dc up` can't pick up the failed one.
restore_pointers() {
  [ -n "$PREV_BACKEND_ID" ] && [ -n "$PREV_WEB_ID" ] || return 0
  docker tag "$PREV_BACKEND_ID" "$LOCAL_BACKEND:prod"
  docker tag "$PREV_WEB_ID" "$LOCAL_WEB:prod"
  git -C "$OPS_REPO_DIR" checkout --quiet --detach "$PREVIOUS"
}

rollback() {
  local revision
  restore_pointers
  echo "rolling back to $PREVIOUS"
  dc up -d --no-build >> "$DIAG_FILE" 2>&1 || true
  revision=$(image_label "$PREV_BACKEND_ID" org.opencontainers.image.revision || true)
  is_sha "$revision" || revision="" # releases from before this pipeline report none
  wait_healthy "$PREV_BACKEND_ID" "$PREV_WEB_ID" "$revision" 1
}

needs_human() {
  ops_log ALERT deploy "$SHA failed and needs manual intervention: $*"
  record_release failed "$SHA" "${BACKEND_REF:-none}" "${WEB_REF:-none}"
  echo "MANUAL INTERVENTION REQUIRED: $*"
  echo "see docs/development/deployment.md#recovering-from-a-failed-deployment"
  finish failed 3
}

handle_failure() { # REASON
  local applied_after failed_now newly contract_applied
  trap - ERR
  ops_log ALERT deploy "$SHA failed: $1"
  print_state
  write_diagnostics

  if ! applied_after=$(migration_rows applied) || ! failed_now=$(migration_rows failed); then
    needs_human "the migration state could not be read after the failure"
  fi

  # Prisma records a failed migration and refuses to run any other until it
  # is resolved by hand. migrate ran before backend/worker were replaced, so
  # the previous release's containers should still be the ones serving
  # (the state above shows what is actually running).
  if [ -n "$failed_now" ]; then
    restore_pointers || true
    needs_human "migration failed: $(paste -sd' ' <<< "$failed_now"); the :prod tags and checkout point at $PREVIOUS again"
  fi

  newly=$(lines_only_in "$applied_after" "$APPLIED_BEFORE")
  contract_applied=$(lines_in_both "$newly" "$CONTRACT_PENDING")
  if [ -n "$contract_applied" ]; then
    needs_human "contract migration(s) applied ($(paste -sd' ' <<< "$contract_applied")); $PREVIOUS may depend on what they removed, so it is not restored automatically"
  fi

  [ -n "$PREV_BACKEND_ID" ] && [ -n "$PREV_WEB_ID" ] ||
    needs_human "no previous release images to roll back to"

  # Expand-only migrations (if any) stay applied: the previous release was
  # already serving against them while migrate ran, which is exactly the
  # compatibility the expand/contract rule guarantees.
  if rollback; then
    ops_log ALERT deploy "$SHA rolled back to $PREVIOUS"
    record_release rolled_back "$SHA" "${BACKEND_REF:-none}" "${WEB_REF:-none}"
    finish rolled_back 2
  fi
  print_state
  needs_human "rollback to $PREVIOUS did not become healthy: $GATE_REASON"
}

# --- modes -----------------------------------------------------------------

verify() {
  local backend_id web_id
  [ -n "$SHA" ] || SHA=$(cat "$CURRENT_FILE" 2> /dev/null || true)
  is_sha "$SHA" || reject "no release recorded yet; pass the expected <sha>"

  backend_id=$(image_id "$LOCAL_BACKEND:prod") || reject "$LOCAL_BACKEND:prod does not exist"
  web_id=$(image_id "$LOCAL_WEB:prod") || reject "$LOCAL_WEB:prod does not exist"
  [ "$(image_label "$backend_id" org.opencontainers.image.revision)" = "$SHA" ] &&
    [ "$(image_label "$web_id" org.opencontainers.image.revision)" = "$SHA" ] ||
    { print_state; ops_log ALERT deploy "verify: :prod images are not revision $SHA"; finish unhealthy 3; }

  if wait_healthy "$backend_id" "$web_id" "$SHA" 0; then
    ops_log OK deploy "verified $SHA is live and healthy"
    finish verified 0
  fi
  print_state
  ops_log ALERT deploy "verify $SHA: $GATE_REASON"
  finish unhealthy 3
}

resolve_repository() {
  local url owner name
  url=$(git -C "$OPS_REPO_DIR" config --get remote.origin.url) || return 1
  [[ $url =~ ^https://github\.com/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)$ ]] || return 1
  owner=${BASH_REMATCH[1]}
  name=${BASH_REMATCH[2]%.git}
  SOURCE_URL="${TEAMOS_SOURCE_URL:-https://github.com/$owner/$name}"
  IMAGE_PREFIX="${TEAMOS_IMAGE_PREFIX:-ghcr.io/${owner,,}}"
}

# Shared by deploy and preflight: the repository, an up-to-date origin/main,
# a clean checkout, and which release is live.
prepare_checkout() {
  resolve_repository || reject "origin is not an https://github.com/<owner>/<repo> URL"
  BACKEND_IMAGE="$IMAGE_PREFIX/$LOCAL_BACKEND"
  WEB_IMAGE="$IMAGE_PREFIX/$LOCAL_WEB"

  git -C "$OPS_REPO_DIR" fetch --quiet origin || reject "git fetch origin failed"
  [ -z "$(git -C "$OPS_REPO_DIR" status --porcelain --untracked-files=no)" ] ||
    reject "the checkout has local modifications"

  # Before this script's first run there is no record yet: the release that
  # is live is the one the checkout was last deployed from.
  PREVIOUS=$(cat "$CURRENT_FILE" 2> /dev/null || git -C "$OPS_REPO_DIR" rev-parse HEAD)
  is_sha "$PREVIOUS" || reject "the recorded current release is not a commit SHA"
}

preflight() {
  prepare_checkout
  SHA=$(git -C "$OPS_REPO_DIR" rev-parse origin/main)
  docker info > /dev/null 2>&1 || reject "cannot reach the Docker daemon as $(id -un)"
  [ -n "$(env_value PUBLIC_ORIGIN)" ] || reject "PUBLIC_ORIGIN is not set in $OPS_ENV_FILE"
  [ -n "$(running_image backend)" ] || reject "the production stack is not running"
  [ -x "$BACKUP_SCRIPT" ] || reject "$BACKUP_SCRIPT is missing"
  ops_log OK deploy "preflight: ready (live $PREVIOUS, origin/main $SHA)"
  finish ready 0
}

deploy() {
  local git_dir=(git -C "$OPS_REPO_DIR") ref label expected origin failed pending name classes
  local image_list pending_count check_restarts

  prepare_checkout

  # Only commits that reached main are releases.
  "${git_dir[@]}" cat-file -e "$SHA^{commit}" 2> /dev/null || reject "unknown commit"
  "${git_dir[@]}" merge-base --is-ancestor "$SHA" origin/main || reject "not a commit on origin/main"

  if [ "$SHA" != "$PREVIOUS" ]; then
    if "${git_dir[@]}" merge-base --is-ancestor "$PREVIOUS" "$SHA" 2> /dev/null; then
      : # newer than what is live
    elif "${git_dir[@]}" merge-base --is-ancestor "$SHA" "$PREVIOUS" 2> /dev/null; then
      if [ "$ALLOW_OLDER" != 1 ]; then
        ops_log OK deploy "skipped $SHA: the live release $PREVIOUS is newer"
        finish stale 4
      fi
    else
      reject "$SHA and the live release $PREVIOUS have diverged"
    fi
  fi

  # Pull and check provenance before touching anything.
  for ref in "$BACKEND_IMAGE:$SHA" "$WEB_IMAGE:$SHA"; do
    docker pull -q "$ref" > /dev/null ||
      reject "could not pull $ref (not published yet, or the GHCR package is not public)"
    for label in org.opencontainers.image.revision org.opencontainers.image.source; do
      case "$label" in
        *revision) expected=$SHA ;;
        *source) expected=$SOURCE_URL ;;
      esac
      [ "$(image_label "$ref" "$label")" = "$expected" ] ||
        reject "$ref has $label '$(image_label "$ref" "$label")', expected '$expected'"
    done
  done
  origin=$(env_value PUBLIC_ORIGIN)
  [ "$(image_label "$WEB_IMAGE:$SHA" teamos.public-origin)" = "$origin" ] ||
    reject "$WEB_IMAGE:$SHA was built for '$(image_label "$WEB_IMAGE:$SHA" teamos.public-origin)', this host serves '$origin'"
  BACKEND_REF=$(repo_digest "$BACKEND_IMAGE:$SHA" "$BACKEND_IMAGE")
  WEB_REF=$(repo_digest "$WEB_IMAGE:$SHA" "$WEB_IMAGE")

  # Pending migrations: in the new image, not yet applied.
  APPLIED_BEFORE=$(migration_rows applied) || reject "could not read the applied migrations"
  failed=$(migration_rows failed) || reject "could not read the migration state"
  [ -z "$failed" ] ||
    reject "a previous migration failed and must be resolved first: $(paste -sd' ' <<< "$failed")"
  image_list=$(image_migrations "$BACKEND_IMAGE:$SHA") || reject "could not list the image's migrations"
  pending=$(lines_only_in "$image_list" "$APPLIED_BEFORE")

  if [ -n "$pending" ]; then
    WORK_DIR=$(mktemp -d)
    while read -r name; do
      [[ $name =~ ^[A-Za-z0-9_]+$ ]] || reject "unexpected migration name '$name'"
      docker run --rm --network none --entrypoint cat "$BACKEND_IMAGE:$SHA" \
        "prisma/migrations/$name/migration.sql" > "$WORK_DIR/$name.sql" ||
        reject "could not read migration $name from the image"
    done <<< "$pending"
    classes=$("$SCRIPT_DIR/check-migrations.sh" "$WORK_DIR"/*.sql) ||
      reject "unsafe migration(s), see docs/development/deployment.md#database-migrations: $(grep '^unsafe' <<< "$classes" | sed "s#$WORK_DIR/##" | paste -sd';' -)"
    CONTRACT_PENDING=$(awk '$1 == "contract" { print $2 }' <<< "$classes" | xargs -r -n 1 basename -s .sql)
    if [ -n "$CONTRACT_PENDING" ] && [ "$ALLOW_CONTRACT" != 1 ]; then
      reject "contract migration(s) are only applied by hand with --allow-contract: $(paste -sd' ' <<< "$CONTRACT_PENDING")"
    fi
  fi
  pending_count=$(sorted_lines "$pending" | wc -l)

  # The rollback handle: whatever is running now, under its release name -
  # which must really be $PREVIOUS. A deployment interrupted after its
  # containers were replaced (a VM restart, a killed process) leaves the new
  # release running while current-release still names the old one; tagging
  # that as release-$PREVIOUS would make a rollback restore the wrong
  # release. Images built before the release pipeline carry no revision
  # (docker prints `<no value>`), so they can't be checked.
  PREV_BACKEND_ID=$(running_image backend)
  PREV_WEB_ID=$(running_image caddy)
  for ref in "$PREV_BACKEND_ID" "$PREV_WEB_ID"; do
    [ -n "$ref" ] || continue
    label=$(image_label "$ref" org.opencontainers.image.revision)
    ! is_sha "$label" || [ "$label" = "$PREVIOUS" ] ||
      reject "the running containers are release $label, but the recorded current release is $PREVIOUS (an earlier deployment was interrupted?) - see docs/development/deployment.md#recovering-from-a-failed-deployment"
  done

  "$BACKUP_SCRIPT" || reject "the pre-deployment backup failed"

  if [ -n "$PREV_BACKEND_ID" ] && [ -n "$PREV_WEB_ID" ]; then
    docker tag "$PREV_BACKEND_ID" "$LOCAL_BACKEND:release-$PREVIOUS"
    docker tag "$PREV_WEB_ID" "$LOCAL_WEB:release-$PREVIOUS"
    if [ ! -s "$CURRENT_FILE" ]; then
      record_release baseline "$PREVIOUS" "$PREV_BACKEND_ID" "$PREV_WEB_ID"
    fi
  fi

  # --- from here on, production changes ---
  CHANGED=1
  mkdir -p "$DIAG_DIR"
  DIAG_FILE="$DIAG_DIR/$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}.log"
  ops_log OK deploy "deploying $SHA (live: $PREVIOUS, pending migrations: $pending_count)"

  docker tag "$BACKEND_IMAGE:$SHA" "$LOCAL_BACKEND:release-$SHA"
  docker tag "$WEB_IMAGE:$SHA" "$LOCAL_WEB:release-$SHA"
  docker tag "$BACKEND_IMAGE:$SHA" "$LOCAL_BACKEND:prod"
  docker tag "$WEB_IMAGE:$SHA" "$LOCAL_WEB:prod"
  "${git_dir[@]}" checkout --quiet --detach "$SHA"

  # migrate (new image) runs and must finish before backend and worker are
  # recreated; caddy is recreated once backend is healthy.
  if ! dc up -d --no-build >> "$DIAG_FILE" 2>&1; then
    handle_failure "docker compose up failed"
  fi
  # A redeploy of the live release keeps its containers, and with them any
  # restarts they had before; only freshly created containers must have none.
  check_restarts=1
  [ "$SHA" != "$PREVIOUS" ] || check_restarts=0
  if ! wait_healthy "$(image_id "$LOCAL_BACKEND:prod")" "$(image_id "$LOCAL_WEB:prod")" "$SHA" "$check_restarts"; then
    handle_failure "health gate: $GATE_REASON"
  fi

  record_release success "$SHA" "$BACKEND_REF" "$WEB_REF"
  printf '%s\n' "$SHA" > "$CURRENT_FILE"
  prune_releases
  ops_log OK deploy "$SHA is live (previous $PREVIOUS, backend $BACKEND_REF, web $WEB_REF)"
  finish success 0
}

# --- main ------------------------------------------------------------------

while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify) MODE=verify ;;
    --preflight) MODE=preflight ;;
    --allow-older) ALLOW_OLDER=1 ;;
    --allow-contract) ALLOW_CONTRACT=1 ;;
    -*) reject "unknown option $1" ;;
    *) [ -z "$SHA" ] || reject "more than one commit given"; SHA=$1 ;;
  esac
  shift
done

if [ "$MODE" = deploy ] || [ -n "$SHA" ]; then
  if ! is_sha "$SHA"; then
    given=$SHA
    SHA=""
    reject "'$given' is not a full 40-character lowercase commit SHA"
  fi
fi

mkdir -p "$OPS_STATE_DIR"
exec 9> "$LOCK_FILE"
flock -n 9 || reject "another deployment is in progress"

case "$MODE" in
  verify) verify ;;
  preflight) preflight ;;
esac
deploy
