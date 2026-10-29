# shellcheck shell=bash
# Shared helpers for scripts/ops/*.sh. Sourced, never executed directly.
#
# Every script runs from the production checkout on the VM (see
# docs/development/deployment.md) unless its header says otherwise. Secrets
# are read from .env.production by key and passed on only through the
# environment - never printed, logged, or placed on a command line.

set -Eeuo pipefail
umask 077

OPS_REPO_DIR="${OPS_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OPS_ENV_FILE="${OPS_ENV_FILE:-$OPS_REPO_DIR/.env.production}"
OPS_LOG="${OPS_LOG:-$HOME/teamos-ops/ops.log}"
# Used by the scripts that source this file, not here.
# shellcheck disable=SC2034
OPS_STATE_DIR="${OPS_STATE_DIR:-$HOME/teamos-ops/state}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/teamos-backups}"

# Rotated once it passes this size, keeping a single previous file.
OPS_LOG_MAX_BYTES="${OPS_LOG_MAX_BYTES:-5242880}"

# ops_log LEVEL COMPONENT MESSAGE...
# LEVEL is OK, WARN, or ALERT. Lines are also echoed so cron mail and manual
# runs show them.
ops_log() {
  local level=$1 component=$2
  shift 2

  mkdir -p "$(dirname "$OPS_LOG")"
  if [ -f "$OPS_LOG" ] && [ "$(wc -c < "$OPS_LOG")" -gt "$OPS_LOG_MAX_BYTES" ]; then
    mv -f "$OPS_LOG" "$OPS_LOG.1"
  fi

  printf '%s %s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$component" "$*" |
    tee -a "$OPS_LOG"
}

# env_value KEY - the value of KEY in .env.production, quotes stripped.
env_value() {
  local line
  line=$(grep -E "^$1=" "$OPS_ENV_FILE" | tail -n 1 || true)
  line=${line#*=}
  line=${line%\"}
  line=${line#\"}
  line=${line%\'}
  line=${line#\'}
  printf '%s' "$line"
}

dc() {
  docker compose -f "$OPS_REPO_DIR/docker-compose.prod.yml" --env-file "$OPS_ENV_FILE" "$@"
}

# in_postgres SNIPPET - runs a shell snippet where the Postgres client tools
# and $POSTGRES_USER / $POSTGRES_DB are defined: inside the compose postgres
# container on the VM. OPS_LOCAL_POSTGRES=1 runs it on this host instead
# (with PG* connection variables and POSTGRES_USER/POSTGRES_DB exported);
# that exists only to exercise these scripts against a local server.
in_postgres() {
  if [ "${OPS_LOCAL_POSTGRES:-0}" = 1 ]; then
    sh -c "$1"
  else
    dc exec -T postgres sh -c "$1"
  fi
}

newest_backup() { # PATTERN
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "$1" -printf '%T@ %p\n' 2>/dev/null |
    sort -n | tail -n 1 | cut -d' ' -f2-
}
