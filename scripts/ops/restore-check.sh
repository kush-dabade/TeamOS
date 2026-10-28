#!/usr/bin/env bash
# Proves a dump is restorable: restores it into a scratch database next to
# the live one, checks the schema and data came back, and drops the scratch
# database again. The live database is only ever read. Runs on the VM.
#
# Usage: scripts/ops/restore-check.sh [path/to/teamos-db-<ts>.dump]
#        (defaults to the newest dump in BACKUP_DIR)

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SCRATCH_DB=teamos_restore_check
TABLES='"user" "Workspace" "WorkspaceMember" "Project" "Task" "Sprint" "Comment" "Attachment" "Notification" "Activity" "_prisma_migrations"'

fail() {
  ops_log ALERT restore-check "$*"
  exit 1
}

DUMP="${1:-$(newest_backup 'teamos-db-*.dump')}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || fail "no dump found in $BACKUP_DIR"

SUMS="$(dirname "$DUMP")/teamos-$(basename "$DUMP" .dump | sed 's/^teamos-db-//').sha256"
if [ -f "$SUMS" ]; then
  (cd "$(dirname "$DUMP")" && grep " $(basename "$DUMP")\$" "$SUMS" | sha256sum -c --quiet -) ||
    fail "checksum mismatch for $(basename "$DUMP")"
fi

# Guard against ever pointing the drop at the live database.
LIVE_DB=$(in_postgres 'printf %s "$POSTGRES_DB"')
[ "$LIVE_DB" != "$SCRATCH_DB" ] || fail "scratch database name collides with the live database"

drop_scratch() {
  in_postgres "dropdb -U \"\$POSTGRES_USER\" --if-exists $SCRATCH_DB" > /dev/null 2>&1 || true
}
trap drop_scratch EXIT

drop_scratch
in_postgres "createdb -U \"\$POSTGRES_USER\" $SCRATCH_DB" || fail "could not create $SCRATCH_DB"
in_postgres "pg_restore -U \"\$POSTGRES_USER\" -d $SCRATCH_DB --no-owner --exit-on-error" < "$DUMP" ||
  fail "pg_restore of $(basename "$DUMP") failed"

count_sql=""
for table in $TABLES; do
  count_sql="$count_sql UNION ALL SELECT '$table', count(*) FROM $table"
done
count_sql="${count_sql# UNION ALL }"

counts() { # DATABASE_EXPRESSION
  in_postgres "psql -U \"\$POSTGRES_USER\" -d $1 -AtX -F ' ' -v ON_ERROR_STOP=1 -c \"$(printf '%s' "$count_sql" | sed 's/"/\\"/g')\""
}

RESTORED=$(counts "$SCRATCH_DB") || fail "restored database is missing expected tables"
LIVE=$(counts '"$POSTGRES_DB"') || fail "could not read live row counts"

restored_migrations=$(printf '%s\n' "$RESTORED" | awk '$1 == "\"_prisma_migrations\"" { print $2 }')
live_migrations=$(printf '%s\n' "$LIVE" | awk '$1 == "\"_prisma_migrations\"" { print $2 }')
restored_users=$(printf '%s\n' "$RESTORED" | awk '$1 == "\"user\"" { print $2 }')

summary=$(paste -d' ' <(printf '%s\n' "$RESTORED") <(printf '%s\n' "$LIVE" | cut -d' ' -f2) |
  awk '{ printf "%s=%s/%s ", $1, $2, $3 }')

# Row counts legitimately drift between the dump and now (new rows, demo
# cleanup), so they're reported (restored/live), not compared. What must
# hold is that the schema version matches and the data isn't empty.
[ "$restored_migrations" = "$live_migrations" ] ||
  fail "migration count differs (restored $restored_migrations, live $live_migrations): $summary"
[ "${restored_users:-0}" -gt 0 ] || fail "restored database has no users: $summary"

ops_log OK restore-check "$(basename "$DUMP") restored and dropped; restored/live ${summary% }"
