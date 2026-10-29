#!/bin/sh
# Entry point for Azure Run Command. The Release and Production check
# workflows send this file's contents to the VM, where it runs as root with
# no repository checkout of its own. It hands off to the user that owns the
# production checkout and runs deploy.sh from:
#
#   deploy <sha>     the requested release itself (extracted with git
#                    archive), so a release always deploys with its own
#                    deploy logic and the first release that adds this
#                    script needs no bootstrap step
#   verify [<sha>]   origin/main; without <sha>, the recorded live release
#   preflight        origin/main; changes nothing - proves the VM side of
#                    the pipeline works before the first deployment
#
# The checkout is not touched here; deploy.sh decides when it moves.
# POSIX sh, because Run Command does not guarantee that bash runs the script.
#
# Usage (as root): run-deploy.sh deploy <sha> | verify [<sha>] | preflight
# Env:   TEAMOS_DEPLOY_USER (azureuser), TEAMOS_DEPLOY_DIR (<that user's home>/TeamOS)

set -eu

action=${1:-}
sha=${2:-}

reject() {
  echo "run-deploy: $*" >&2
  echo "TEAMOS_DEPLOY_RESULT=rejected sha=none previous=none"
  exit 1
}

case "$action" in
  deploy) [ -n "$sha" ] || reject "deploy needs a commit SHA" ;;
  verify) ;;
  preflight) [ -z "$sha" ] || reject "preflight takes no commit SHA" ;;
  *) reject "usage: run-deploy.sh deploy <sha> | verify [<sha>] | preflight" ;;
esac
if [ -n "$sha" ]; then
  case "$sha" in
    *[!0-9a-f]*) reject "not a full 40-character lowercase commit SHA" ;;
  esac
  [ "${#sha}" -eq 40 ] || reject "not a full 40-character lowercase commit SHA"
fi

deploy_user=${TEAMOS_DEPLOY_USER:-azureuser}
deploy_home=$(getent passwd "$deploy_user" | cut -d: -f6)
[ -n "$deploy_home" ] || reject "no such user: $deploy_user"
deploy_dir=${TEAMOS_DEPLOY_DIR:-$deploy_home/TeamOS}
[ -d "$deploy_dir/.git" ] || reject "$deploy_dir is not a git checkout"

# Run Command starts in a root-only directory; leave it before switching
# user. -H: HOME becomes the deploy user's, which is where the operations
# log, release state and backups live (scripts/ops/lib.sh).
cd /
exec sudo -u "$deploy_user" -H -- bash -s -- "$action" "$sha" "$deploy_dir" << 'AS_DEPLOY_USER'
set -Eeuo pipefail
action=$1 sha=$2 repo=$3

reject() {
  echo "run-deploy: $*" >&2
  echo "TEAMOS_DEPLOY_RESULT=rejected sha=${sha:-none} previous=none"
  exit 1
}

git -C "$repo" fetch --quiet origin || reject "git fetch origin failed"

source_rev=origin/main
if [ "$action" = deploy ]; then
  git -C "$repo" cat-file -e "$sha^{commit}" 2> /dev/null || reject "unknown commit $sha"
  source_rev=$sha
fi
git -C "$repo" cat-file -e "$source_rev:scripts/ops/deploy.sh" 2> /dev/null ||
  reject "$source_rev has no scripts/ops/deploy.sh"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git -C "$repo" archive "$source_rev" scripts/ops | tar -x -C "$work"

case "$action" in
  deploy) set -- "$sha" ;;
  verify) set -- --verify ${sha:+"$sha"} ;;
  preflight) set -- --preflight ;;
esac
# stdin is this script; nothing deploy.sh runs may read from it.
OPS_REPO_DIR=$repo "$work/scripts/ops/deploy.sh" "$@" < /dev/null
AS_DEPLOY_USER
