#!/usr/bin/env bash
# Periodic health check on the VM (cron, every 15 minutes). Appends one line
# per check to the operations log and exits non-zero if anything needs
# attention now:
#
#   ALERT  readiness probe failing, a service down/unhealthy, new permanently
#          failed email jobs since the last run, or the newest backup too old
#   WARN   low available memory or a filling disk
#
# Usage: scripts/ops/ops-check.sh
# Env:   BACKUP_MAX_AGE_HOURS (26), MEM_MIN_AVAILABLE_MB (150), DISK_MAX_USED_PERCENT (85)

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
MEM_MIN_AVAILABLE_MB="${MEM_MIN_AVAILABLE_MB:-150}"
DISK_MAX_USED_PERCENT="${DISK_MAX_USED_PERCENT:-85}"
EMAIL_FAILED_STATE="$OPS_STATE_DIR/email-failed-count"

alerts=0
alert() { ops_log ALERT "$@"; alerts=$((alerts + 1)); }

check_readiness() {
  local origin
  origin=$(env_value PUBLIC_ORIGIN)
  if curl -fsS --max-time 10 -o /dev/null "$origin/ready"; then
    ops_log OK readiness "/ready responded"
  else
    alert readiness "/ready failed - Postgres or Redis unreachable, or the backend is down"
  fi
}

check_services() {
  local bad
  # migrate is a one-shot job that is expected to have exited.
  bad=$(dc ps -a --format '{{.Service}} {{.State}} {{.Health}}' |
    awk '$1 != "migrate" && ($2 != "running" || $3 == "unhealthy") { print $1 "(" $2 ($3 ? "," $3 : "") ")" }' |
    paste -sd' ' -)
  if [ -n "$bad" ]; then
    alert services "not running or unhealthy: $bad"
  else
    ops_log OK services "all running"
  fi
}

check_email_failures() {
  local total previous redis_container
  redis_container=$(dc ps -q redis)
  # REDISCLI_AUTH is read by redis-cli from its environment; `-e NAME`
  # without a value forwards it from this process, keeping it off the
  # command line.
  if ! total=$(REDISCLI_AUTH=$(env_value REDIS_PASSWORD) \
    docker exec -e REDISCLI_AUTH "$redis_container" redis-cli --no-auth-warning ZCARD bull:email:failed); then
    alert email "could not read the email queue's failed set"
    return
  fi

  mkdir -p "$OPS_STATE_DIR"
  previous=$(cat "$EMAIL_FAILED_STATE" 2>/dev/null || echo "$total")
  printf '%s\n' "$total" > "$EMAIL_FAILED_STATE"

  # Compared with the previous run rather than zero: failed jobs are
  # retained for 7 days, so the total alone would alert on old failures
  # forever. The set can also shrink as retention trims it.
  if [ "$total" -gt "$previous" ]; then
    alert email "$((total - previous)) new permanently failed email job(s) (failed set: $total) - see 'dc logs worker | grep EMAIL_DELIVERY_FAILED'"
  else
    ops_log OK email "no new delivery failures (failed set: $total)"
  fi
}

check_backup_age() {
  local newest age_hours
  newest=$(newest_backup 'teamos-db-*.dump')
  if [ -z "$newest" ]; then
    alert backup-age "no database backup found in $BACKUP_DIR"
    return
  fi
  age_hours=$((($(date +%s) - $(stat -c %Y "$newest")) / 3600))
  if [ "$age_hours" -ge "$BACKUP_MAX_AGE_HOURS" ]; then
    alert backup-age "newest backup $(basename "$newest") is ${age_hours}h old"
  else
    ops_log OK backup-age "newest backup is ${age_hours}h old"
  fi
}

check_resources() {
  local available_mb used_percent
  available_mb=$(awk '/^MemAvailable:/ { print int($2 / 1024) }' /proc/meminfo)
  used_percent=$(df -P / | awk 'NR == 2 { gsub("%", "", $5); print $5 }')

  if [ "$available_mb" -lt "$MEM_MIN_AVAILABLE_MB" ]; then
    ops_log WARN memory "${available_mb} MB available (threshold ${MEM_MIN_AVAILABLE_MB} MB)"
  else
    ops_log OK memory "${available_mb} MB available"
  fi

  if [ "$used_percent" -gt "$DISK_MAX_USED_PERCENT" ]; then
    ops_log WARN disk "root filesystem ${used_percent}% used (threshold ${DISK_MAX_USED_PERCENT}%)"
  else
    ops_log OK disk "root filesystem ${used_percent}% used"
  fi
}

check_readiness
check_services
check_email_failures
check_backup_age
check_resources

if [ "$alerts" -gt 0 ]; then
  ops_log ALERT summary "$alerts check(s) need attention"
  exit 1
fi
ops_log OK summary "all checks passed"
