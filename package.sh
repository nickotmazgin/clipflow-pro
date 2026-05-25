#!/bin/bash

# ClipFlow Pro - Package script
# Produces zips for GNOME 43-44 and 45-50 without bumping version.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
BUILD_DIR="${ROOT_DIR}/build"
LEGACY_BUILD_DIR="${ROOT_DIR}/build-43-44"
PYTHON="${PYTHON:-python3}"
if ! "${PYTHON}" --version >/dev/null 2>&1; then
  PYTHON="python"
fi

mkdir -p "${DIST_DIR}"

echo "[1/4] Running build-legacy.sh"
"${ROOT_DIR}/build-legacy.sh"

echo "[2/4] Running build.sh"
"${ROOT_DIR}/build.sh"

if [[ ! -f "${BUILD_DIR}/metadata.json" ]]; then
  echo "Error: metadata.json not found in build output" >&2
  exit 1
fi

# Read metadata to obtain uuid and version-name base
UUID=$(BUILD_DIR="${BUILD_DIR}" "${PYTHON}" - <<'PY'
import json,sys
import os
from pathlib import Path
with (Path(os.environ['BUILD_DIR']) / 'metadata.json').open('r',encoding='utf-8') as f:
    m=json.load(f)
print(m.get('uuid','clipflow-pro@nickotmazgin.github.io'))
PY
)

BASE_VER=$(BUILD_DIR="${BUILD_DIR}" "${PYTHON}" - <<'PY'
import json,sys
import os
from pathlib import Path
with (Path(os.environ['BUILD_DIR']) / 'metadata.json').open('r',encoding='utf-8') as f:
    m=json.load(f)
vn=m.get('version-name','').strip()
print((vn.split()[0] if vn else '1.3.4'))
PY
)

ZIP_4344="${DIST_DIR}/${UUID}-${BASE_VER}-gs43-44.zip"
ZIP_4550="${DIST_DIR}/${UUID}-${BASE_VER}-gs45-50.zip"

echo "[3/4] Creating GNOME 43-44 zip: ${ZIP_4344}"
"${PYTHON}" "${ROOT_DIR}/tools/zip_dir.py" "${LEGACY_BUILD_DIR}" "${ZIP_4344}" . --exclude "schemas/gschemas.compiled"

echo "[4/4] Creating GNOME 45-50 zip: ${ZIP_4550}"
"${PYTHON}" "${ROOT_DIR}/tools/zip_dir.py" "${BUILD_DIR}" "${ZIP_4550}" . --exclude "schemas/gschemas.compiled"

echo "Done. Artifacts:"
echo "  - ${ZIP_4344}"
echo "  - ${ZIP_4550}"
