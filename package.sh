#!/bin/bash

# ClipFlow Pro - Package script
# Produces EGO-compliant zips for GNOME 43–44 and 45–47 without bumping version.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
BUILD_DIR="${ROOT_DIR}/build"

mkdir -p "${DIST_DIR}"

echo "[1/4] Running build.sh"
"${ROOT_DIR}/build.sh"

if [[ ! -f "${BUILD_DIR}/metadata.json" ]]; then
  echo "Error: metadata.json not found in build output" >&2
  exit 1
fi

# Read metadata to obtain uuid and version-name base
UUID=$(python3 - <<'PY'
import json,sys
with open('build/metadata.json','r',encoding='utf-8') as f:
    m=json.load(f)
print(m.get('uuid','clipflow-pro@nickotmazgin.github.io'))
PY
)

BASE_VER=$(python3 - <<'PY'
import json,sys
with open('build/metadata.json','r',encoding='utf-8') as f:
    m=json.load(f)
vn=m.get('version-name','').strip()
print((vn.split()[0] if vn else '1.3.4'))
PY
)

ZIP_4344="${DIST_DIR}/${UUID}-${BASE_VER}-gs43-44.zip"
ZIP_4547="${DIST_DIR}/${UUID}-${BASE_VER}-gs45-47.zip"

echo "[2/4] Creating GNOME 43–44 zip: ${ZIP_4344}"
(
  cd "${BUILD_DIR}"
  rm -f "${ZIP_4344}"
  zip -qry "${ZIP_4344}" .
)

echo "[3/4] Preparing GNOME 45–47 temp build"
TMP45="$(mktemp -d)"
trap 'rm -rf "${TMP45}"' EXIT
cp -a "${BUILD_DIR}/." "${TMP45}/"

# Swap in ES6 prefs for GNOME 45–47
if [[ -f "${ROOT_DIR}/prefs-es6.js" ]]; then
  cp "${ROOT_DIR}/prefs-es6.js" "${TMP45}/prefs.js"
else
  echo "Warning: prefs-es6.js not found; 45–47 settings may fail to open." >&2
fi

TMP45_DIR="${TMP45}" python3 - <<'PY'
import json, os
from pathlib import Path
mf=Path(os.environ['TMP45_DIR'])/"metadata.json"
with mf.open('r',encoding='utf-8') as f:
    m=json.load(f)
base=(m.get('version-name','').split()[0] if m.get('version-name') else '1.3.4')
m['shell-version']=["45","46","47"]
m['version-name']=f"{base} 45.47"
with mf.open('w',encoding='utf-8') as f:
    json.dump(m,f,ensure_ascii=False,indent=2)
PY

echo "[4/4] Creating GNOME 45–47 zip: ${ZIP_4547}"
(
  cd "${TMP45}"
  rm -f "${ZIP_4547}"
  zip -qry "${ZIP_4547}" .
)

echo "Done. Artifacts:"
echo "  - ${ZIP_4344}"
echo "  - ${ZIP_4547}"
