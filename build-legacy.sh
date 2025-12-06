#!/bin/bash

# ClipFlow Pro - Build Script (GNOME 43–44)
# Produces build-43-44/ using the same codebase, swapping metadata for 43–44.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build-43-44"
SCHEMAS_DIR="${SCRIPT_DIR}/schemas"
ICON_DIR="${SCRIPT_DIR}/icons"

echo "Building ClipFlow Pro (GNOME 43–44) ..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

echo "Copying core files..."
for file in extension.js prefs.js stylesheet.css; do
  cp "${SCRIPT_DIR}/${file}" "${BUILD_DIR}/"
done

echo "Applying 43–44 metadata..."
cp "${SCRIPT_DIR}/metadata-43-44.json" "${BUILD_DIR}/metadata.json"

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
