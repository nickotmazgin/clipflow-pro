#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
UUID="clipflow-pro@nickotmazgin.github.io"
PYTHON="${PYTHON:-python3}"
if ! "${PYTHON}" --version >/dev/null 2>&1; then
    PYTHON="python"
fi

# Derive version info from root metadata.json
VERSION_BASE=$(ROOT_DIR="${ROOT_DIR}" "${PYTHON}" - <<'PYEOF'
import json
import os
from pathlib import Path
with (Path(os.environ['ROOT_DIR']) / 'metadata.json').open('r',encoding='utf-8') as f:
    m=json.load(f)
vn=(m.get('version-name') or '').strip()
print(vn.split()[0] if vn else '1.3.7')
PYEOF
)

mkdir -p "${DIST_DIR}"

echo "Building GNOME 45-50 package tree..."
"${ROOT_DIR}/build.sh"

echo "Creating GNOME 45-50 zip..."
"${PYTHON}" "${ROOT_DIR}/tools/zip_dir.py" \
  "${ROOT_DIR}/build" \
  "${DIST_DIR}/${UUID}-${VERSION_BASE}-gs45-50.zip" \
  . \
  --exclude "schemas/gschemas.compiled"

echo "Done! Created:"
echo "  - ${DIST_DIR}/${UUID}-${VERSION_BASE}-gs45-50.zip"
