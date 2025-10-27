#!/usr/bin/env bash
#
# clean_workspace.sh
# -------------------
# Lightweight janitor for the ClipFlow Pro repository.  Removes build artefacts,
# compiled schemas, and temporary/backup files that tend to accumulate during
# development sessions.
#
# Usage:
#   ./tools/clean_workspace.sh               # wipe build/ and common temp files
#   ./tools/clean_workspace.sh --keep-build  # keep build/ directory
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEEP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-build)
      KEEP_BUILD=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

log() { printf '[clean] %s\n' "$*"; }

# 1. Remove build artefacts ---------------------------------------------------
if [[ "${KEEP_BUILD}" -eq 0 && -d "${REPO_ROOT}/build" ]]; then
  log "Removing build/ directory"
  rm -rf "${REPO_ROOT}/build"
elif [[ -d "${REPO_ROOT}/build" ]]; then
  log "Preserving build/ (per --keep-build)"
fi

if [[ -f "${REPO_ROOT}/schemas/gschemas.compiled" ]]; then
  log "Removing compiled schema cache"
  rm -f "${REPO_ROOT}/schemas/gschemas.compiled"
fi

# 2. Purge temporary / backup files ------------------------------------------
log "Deleting temporary and backup files"
find "${REPO_ROOT}" \
  -type f \
  ! -path "${REPO_ROOT}/.git/*" \
  ! -path "${REPO_ROOT}/.git" \
  \( -name '*.tmp' -o -name '*.temp' -o -name '*.bak' -o -name '*.bak.*' -o -name '*.orig' -o -name '*.rej' -o -name '*~' \) \
  -print -delete

# 3. Remove empty directories left behind ------------------------------------
log "Removing empty directories"
find "${REPO_ROOT}" \
  -type d -empty \
  ! -path "${REPO_ROOT}/.git/*" \
  ! -path "${REPO_ROOT}/.git" \
  -print -delete || true

# 4. Summary -----------------------------------------------------------------
log "Workspace tidy complete."
git -C "${REPO_ROOT}" status -sb
