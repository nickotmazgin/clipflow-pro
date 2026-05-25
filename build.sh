#!/bin/bash

# ClipFlow Pro - Build Script (GNOME 45-50)
# Prepares the ES module extension assets in ./build for installation or packaging.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

PYTHON="${PYTHON:-python3}"
if ! "${PYTHON}" --version >/dev/null 2>&1; then
    PYTHON="python"
fi

BUILD_DIR="build"
SCHEMAS_DIR="schemas"
LOCALE_DIR="locale"
ICON_DIR="icons"

echo "Building ClipFlow Pro extension (GNOME 45-50)..."

echo "Resetting build directory..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

echo "Copying core extension files..."
for file in stylesheet.css metadata.json; do
    if [[ ! -f "${file}" ]]; then
        echo "Error: required file '${file}' is missing." >&2
        exit 1
    fi
    cp "${file}" "${BUILD_DIR}/"
done

if [[ ! -f "extension.js" ]]; then
    echo "Error: required file 'extension.js' is missing." >&2
    exit 1
fi
"${PYTHON}" tools/build_modern_extension.py extension.js "${BUILD_DIR}/extension.js"

if [[ -f "prefs-es6.js" ]]; then
    cp "prefs-es6.js" "${BUILD_DIR}/prefs.js"
else
    echo "Error: required file 'prefs-es6.js' is missing." >&2
    exit 1
fi

echo "Stamping GNOME 45-50 metadata..."
"${PYTHON}" - <<'PY'
import json
from pathlib import Path

path = Path('build/metadata.json')
metadata = json.loads(path.read_text(encoding='utf-8'))
base = metadata.get('version-name', '').split()[0] if metadata.get('version-name') else '1.3.9'
metadata['shell-version'] = ['45', '46', '47', '48', '49', '50']
metadata['version-name'] = f'{base} 45.50'
path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY

echo "Copying icons..."
if [[ -d "${ICON_DIR}" ]]; then
    cp -r "${ICON_DIR}" "${BUILD_DIR}/"
else
    echo "Warning: icons directory not found; panel icon may be missing." >&2
fi

echo "Preparing GSettings schemas (XML only) ..."
if [[ -d "${SCHEMAS_DIR}" ]]; then
    mkdir -p "${BUILD_DIR}/schemas"
    cp "${SCHEMAS_DIR}"/*.xml "${BUILD_DIR}/schemas/"
    # Do NOT ship gschemas.compiled
    rm -f "${BUILD_DIR}/schemas/gschemas.compiled" 2>/dev/null || true
else
    echo "Warning: schemas directory not found; settings will not work." >&2
fi

echo "Copying locale resources..."
if [[ -d "${LOCALE_DIR}" ]]; then
    mapfile -t locale_binaries < <(find "${LOCALE_DIR}" -type f -name '*.mo' 2>/dev/null || true)
    if (( ${#locale_binaries[@]} )); then
        cp -r "${LOCALE_DIR}" "${BUILD_DIR}/"
    else
        echo "Note: no compiled translation files (*.mo) found; skipping locale/ in build output."
    fi
else
    echo "Note: locale directory not found; continuing without translations."
fi

echo "Copying LICENSE file..."
if [[ -f "LICENSE" ]]; then
    cp "LICENSE" "${BUILD_DIR}/"
else
    echo "Warning: LICENSE file not found." >&2
fi

echo "Build completed successfully."
echo "Artifacts available in '${BUILD_DIR}/'."
