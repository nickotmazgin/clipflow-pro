#!/bin/bash

# ClipFlow Pro - Build Script (GNOME 43–44)
# Produces build-43-44/ using legacy prefs and legacy runtime.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build-43-44"
SCHEMAS_DIR="${SCRIPT_DIR}/schemas"
ICON_DIR="${SCRIPT_DIR}/icons"

echo "Building ClipFlow Pro (GNOME 43–44) ..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

echo "Copying core files..."
cp "${SCRIPT_DIR}/extension.js" "${BUILD_DIR}/"
cp "${SCRIPT_DIR}/prefs.js" "${BUILD_DIR}/"
cp "${SCRIPT_DIR}/stylesheet.css" "${BUILD_DIR}/" 2>/dev/null || true

echo "Writing 43–44 metadata..."
python3 - <<'PY'
import json
from pathlib import Path
root = json.loads(Path('metadata.json').read_text(encoding='utf-8'))
base = (root.get('version-name','').split()[0] if root.get('version-name') else '1.3.8')
m = {
  'name': root.get('name','ClipFlow Pro'),
  'description': root.get('description','A modern, powerful clipboard manager for GNOME Shell with intelligent organization, robust history management.'),
  'uuid': root.get('uuid','clipflow-pro@nickotmazgin.github.io'),
  'shell-version': ["43","44"],
  'version': int(root.get('version', 33)),
  'version-name': base,
  'url': root.get('url','https://github.com/nickotmazgin/clipflow-pro'),
  'settings-schema': root.get('settings-schema','org.gnome.shell.extensions.clipflow-pro'),
  'gettext-domain': root.get('gettext-domain','clipflow-pro'),
  'donations': root.get('donations', {'paypal':'nickotmazgin'})
}
Path('build-43-44/metadata.json').write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')
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

echo "Legacy build completed: ${BUILD_DIR}"

