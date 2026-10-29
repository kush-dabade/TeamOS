#!/usr/bin/env bash
# Classifies Prisma migration files by whether the release before them can
# keep running against the schema they produce. That is the precondition for
# applying them while that release is still serving (migrate runs before the
# new backend replaces the old one) and for rolling the application back
# afterwards. See docs/development/deployment.md#database-migrations.
#
#   expand    adds or loosens only: safe to apply automatically
#   contract  destructive, and the file contains the line
#             "-- teamos-migration: contract": allowed, but deploy.sh only
#             applies it when an operator passes --allow-contract
#   unsafe    destructive and unmarked: CI fails and deploy.sh refuses
#
# A pattern check, not a proof. It catches the statements Prisma generates
# for drops, renames, column type changes, new NOT NULL constraints and bulk
# deletes; reviewing a migration is still the author's job.
#
# Usage: scripts/ops/check-migrations.sh FILE...
# Prints one "<class> <file>" line per file; exits 1 if any file is unsafe.

set -Eeuo pipefail

DESTRUCTIVE='\b(DROP[[:space:]]+(TABLE|COLUMN|TYPE|SCHEMA|VIEW|MATERIALIZED[[:space:]]+VIEW|FUNCTION|SEQUENCE)|RENAME|SET[[:space:]]+NOT[[:space:]]+NULL|ALTER[[:space:]]+COLUMN[[:space:]]+[^[:space:]]+[[:space:]]+(SET[[:space:]]+DATA[[:space:]]+)?TYPE|TRUNCATE|DELETE[[:space:]]+FROM)\b'
CONTRACT_MARKER='^[[:space:]]*--[[:space:]]*teamos-migration:[[:space:]]*contract([[:space:]]|$)'

[ "$#" -gt 0 ] || { echo "usage: $0 FILE..." >&2; exit 2; }

unsafe=0
for file in "$@"; do
  # SQL line comments are stripped first, so the marker (or a comment that
  # merely mentions DROP) never counts as a statement.
  first_hit=$(sed 's/--.*$//' "$file" | grep -inE "$DESTRUCTIVE" | head -n 1 || true)

  if [ -z "$first_hit" ]; then
    echo "expand $file"
  elif grep -qiE "$CONTRACT_MARKER" "$file"; then
    echo "contract $file"
  else
    echo "unsafe $file: line ${first_hit%%:*}: $(printf '%s' "${first_hit#*:}" | tr -s '[:space:]' ' ')"
    unsafe=1
  fi
done

exit "$unsafe"
