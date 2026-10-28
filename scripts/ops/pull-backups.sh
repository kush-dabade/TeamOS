#!/usr/bin/env bash
# Runs on the ADMINISTRATOR'S machine, not the VM: copies backup sets that
# backup.sh produced on the VM to local disk over SSH, verifies each copied
# set against its checksum file, and prunes old local copies. This is the
# off-box copy - the VM's own backups share its disk.
#
# Usage: scripts/ops/pull-backups.sh
# Env:   TEAMOS_SSH_HOST (default teamos-vm, an ~/.ssh/config alias),
#        REMOTE_BACKUP_DIR (default teamos-backups, relative to the remote home),
#        LOCAL_BACKUP_DIR (default ~/teamos-backups), LOCAL_RETENTION_DAYS (30)

set -Eeuo pipefail
umask 077

SSH_HOST="${TEAMOS_SSH_HOST:-teamos-vm}"
REMOTE_DIR="${REMOTE_BACKUP_DIR:-teamos-backups}"
LOCAL_DIR="${LOCAL_BACKUP_DIR:-$HOME/teamos-backups}"
RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-30}"
LOG="$LOCAL_DIR/pull.log"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

log() {
  printf '%s %s pull-backups %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" | tee -a "$LOG"
}
trap 'log ALERT "failed at line $LINENO"' ERR

# --ignore-existing: a set already pulled is never overwritten, so a
# corrupted remote file can't replace a good local copy.
rsync -a --ignore-existing --chmod=D700,F600 \
  --include='teamos-db-*.dump' --include='teamos-uploads-*.tar.gz' --include='teamos-*.sha256' \
  --exclude='*' \
  "$SSH_HOST:$REMOTE_DIR/" "$LOCAL_DIR/"

verified=0
for sums in "$LOCAL_DIR"/teamos-*.sha256; do
  [ -e "$sums" ] || continue
  if ! (cd "$LOCAL_DIR" && sha256sum -c --quiet "$(basename "$sums")"); then
    log ALERT "checksum mismatch in $(basename "$sums")"
    exit 1
  fi
  verified=$((verified + 1))
done

[ "$verified" -gt 0 ] || { log ALERT "no backup sets found after pulling from $SSH_HOST"; exit 1; }

find "$LOCAL_DIR" -maxdepth 1 -type f -mtime +"$RETENTION_DAYS" \
  \( -name 'teamos-db-*.dump' -o -name 'teamos-uploads-*.tar.gz' -o -name 'teamos-*.sha256' \) \
  -delete

newest=$(find "$LOCAL_DIR" -maxdepth 1 -name 'teamos-db-*.dump' -printf '%f\n' | sort | tail -n 1)
log OK "$verified set(s) verified locally; newest $newest"
