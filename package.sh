#!/bin/bash

# ClipFlow Pro - Package script
# Produces the GNOME 45-50 release zip without bumping version.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
BUILD_DIR="${ROOT_DIR}/build"
PYTHON="${PYTHON:-python3}"
if ! "${PYTHON}" --version >/dev/null 2>&1; then
  PYTHON="python"
fi

mkdir -p "${DIST_DIR}"

echo "[1/2] Running build.sh"
"${ROOT_DIR}/build.sh"

if [[ ! -f "${BUILD_DIR}/metadata.json" ]]; then
  echo "Error: metadata.json not found in build output" >&2
  exit 1
fi

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

ZIP_4550="${DIST_DIR}/${UUID}-${BASE_VER}-gs45-50.zip"

echo "[2/2] Creating GNOME 45-50 zip: ${ZIP_4550}"
"${PYTHON}" "${ROOT_DIR}/tools/zip_dir.py" "${BUILD_DIR}" "${ZIP_4550}" . --exclude "schemas/gschemas.compiled"

echo "Done. Artifact:"
echo "  - ${ZIP_4550}"
