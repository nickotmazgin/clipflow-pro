#!/bin/bash

# ClipFlow Pro - Build Script
# Prepares the extension assets in ./build for installation or packaging.

set -euo pipefail

BUILD_DIR="build"
SCHEMAS_DIR="schemas"
LOCALE_DIR="locale"
ICON_DIR="icons"

echo "Building ClipFlow Pro extension..."

echo "⟲ Resetting build directory..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

echo "→ Copying core extension files..."
for file in extension.js prefs.js stylesheet.css metadata.json; do
    if [[ ! -f "${file}" ]]; then
        echo "Error: required file '${file}' is missing." >&2
        exit 1
    fi
    cp "${file}" "${BUILD_DIR}/"
done

echo "→ Copying icons..."
if [[ -d "${ICON_DIR}" ]]; then
    cp -r "${ICON_DIR}" "${BUILD_DIR}/"
else
    echo "Warning: icons directory not found; panel icon may be missing." >&2
fi

echo "→ Preparing GSettings schemas..."
if [[ -d "${SCHEMAS_DIR}" ]]; then
    mkdir -p "${BUILD_DIR}/schemas"
    cp "${SCHEMAS_DIR}"/*.xml "${BUILD_DIR}/schemas/"

    if command -v glib-compile-schemas >/dev/null 2>&1; then
        glib-compile-schemas "${BUILD_DIR}/schemas/"
    elif [[ -f "${SCHEMAS_DIR}/gschemas.compiled" ]]; then
        echo "Warning: glib-compile-schemas not found; using precompiled schemas bundle." >&2
        cp "${SCHEMAS_DIR}/gschemas.compiled" "${BUILD_DIR}/schemas/"
    else
        echo "Error: glib-compile-schemas not found and no precompiled schemas available." >&2
        echo "Install GLib tooling or run 'glib-compile-schemas schemas/' once on a machine that has it, then re-run build.sh." >&2
        exit 1
    fi
else
    echo "Warning: schemas directory not found; settings will not work." >&2
fi

echo "→ Copying locale resources..."
if [[ -d "${LOCALE_DIR}" ]]; then
    cp -r "${LOCALE_DIR}" "${BUILD_DIR}/"
else
    echo "Note: locale directory not found; continuing without translations."
fi

echo "→ Copying LICENSE file..."
if [[ -f "LICENSE" ]]; then
    cp "LICENSE" "${BUILD_DIR}/"
else
    echo "Warning: LICENSE file not found." >&2
fi

echo "Build completed successfully."
echo "Artifacts available in '${BUILD_DIR}/'."
