#!/usr/bin/env bash
# Database dump + uploads archive, each verified readable before it counts,
# with checksums and local retention. Runs on the VM, nightly from cron.
# This copy shares the VM's disk; pull-backups.sh on the administrator's
# machine is what takes it off the box.
#
# Usage: scripts/ops/backup.sh
# Env:   BACKUP_DIR (default ~/teamos-backups), BACKUP_RETENTION_DAYS (7),
#        UPLOADS_VOLUME (teamos-prod_uploads-data)

# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-teamos-prod_uploads-data}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
DB_FILE="$BACKUP_DIR/teamos-db-$TS.dump"
UPLOADS_FILE="$BACKUP_DIR/teamos-uploads-$TS.tar.gz"
SUMS_FILE="$BACKUP_DIR/teamos-$TS.sha256"

fail() {
  rm -f "$DB_FILE.partial" "$UPLOADS_FILE.partial"
  ops_log ALERT backup "$*"
  exit 1
}
trap 'fail "unexpected error at line $LINENO"' ERR

archive_uploads() {
  if [ "${OPS_LOCAL_POSTGRES:-0}" = 1 ]; then
    tar -C "${OPS_LOCAL_UPLOADS_DIR:?OPS_LOCAL_UPLOADS_DIR is required in local mode}" -czf - .
  else
    # The backend image already has tar and is present on the host.
    docker run --rm --entrypoint tar -v "$UPLOADS_VOLUME:/data:ro" teamos-backend:prod \
      -C /data -czf - .
  fi
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Written to .partial and renamed only once verified, so a failed or
# interrupted run never leaves a file that looks like a good backup.
in_postgres 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DB_FILE.partial" ||
  fail "pg_dump failed"
[ -s "$DB_FILE.partial" ] || fail "database dump is empty"
in_postgres 'pg_restore --list' < "$DB_FILE.partial" > /dev/null ||
  fail "database dump is not readable by pg_restore"
mv "$DB_FILE.partial" "$DB_FILE"

archive_uploads > "$UPLOADS_FILE.partial" || fail "uploads archive failed"
tar -tzf "$UPLOADS_FILE.partial" > /dev/null || fail "uploads archive is not readable"
mv "$UPLOADS_FILE.partial" "$UPLOADS_FILE"

(cd "$BACKUP_DIR" && sha256sum "$(basename "$DB_FILE")" "$(basename "$UPLOADS_FILE")" > "$SUMS_FILE")
chmod 600 "$DB_FILE" "$UPLOADS_FILE" "$SUMS_FILE"

# Only after this run succeeded, and only files matching this script's own
# naming - never anything else in the directory.
find "$BACKUP_DIR" -maxdepth 1 -type f -mtime +"$RETENTION_DAYS" \
  \( -name 'teamos-db-*.dump' -o -name 'teamos-uploads-*.tar.gz' -o -name 'teamos-*.sha256' \) \
  -delete

ops_log OK backup "db=$(basename "$DB_FILE") ($(du -h "$DB_FILE" | cut -f1))" \
  "uploads=$(basename "$UPLOADS_FILE") ($(du -h "$UPLOADS_FILE" | cut -f1))"
