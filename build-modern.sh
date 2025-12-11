#!/bin/bash

# ClipFlow Pro - Build Script (GNOME 45–47)
# Produces build/ using ES module prefs and updated metadata for 45–47.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
SCHEMAS_DIR="${SCRIPT_DIR}/schemas"
ICON_DIR="${SCRIPT_DIR}/icons"

echo "Building ClipFlow Pro (GNOME 45–47) ..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

echo "Copying core files (ESM prefs)..."
cp "${SCRIPT_DIR}/extension.js" "${BUILD_DIR}/extension.js"
cp "${SCRIPT_DIR}/stylesheet.css" "${BUILD_DIR}/stylesheet.css" 2>/dev/null || true
if [[ -f "${SCRIPT_DIR}/prefs-es6.js" ]]; then
  cp "${SCRIPT_DIR}/prefs-es6.js" "${BUILD_DIR}/prefs.js"
else
  echo "Error: prefs-es6.js not found." >&2
  exit 1
fi

echo "Preparing metadata for 45–47..."
python3 - <<'PY'
import json
from pathlib import Path
m = json.loads(Path('metadata.json').read_text(encoding='utf-8'))
base = (m.get('version-name','').split()[0] if m.get('version-name') else '1.3.4')
m['shell-version'] = ["45","46","47"]
m['version-name'] = f"{base} 45.47"
Path('build/metadata.json').write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')
PY

echo "Copying icons..."
if [[ -d "${ICON_DIR}" ]]; then
  cp -r "${ICON_DIR}" "${BUILD_DIR}/"
fi

echo "Copying schemas (XML only) ..."
mkdir -p "${BUILD_DIR}/schemas"
cp "${SCHEMAS_DIR}"/*.xml "${BUILD_DIR}/schemas/"
rm -f "${BUILD_DIR}/schemas/gschemas.compiled" 2>/dev/null || true

echo "Copying LICENSE ..."
cp "${SCRIPT_DIR}/LICENSE" "${BUILD_DIR}/" 2>/dev/null || true

echo "Modern (45–47) build completed: ${BUILD_DIR}"

