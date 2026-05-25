#!/usr/bin/env bash
set -euo pipefail

# Unified build script to produce two distribution zips under one UUID:
#  - clipflow-pro (ESM) for GNOME 45-50 from this repo
#  - clipflow-pro (legacy) for GNOME 43-44 from this repo

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST_DIR="${ROOT_DIR}/dist"
UUID="clipflow-pro@nickotmazgin.github.io"
PYTHON="${PYTHON:-python3}"
if ! "${PYTHON}" --version >/dev/null 2>&1; then
  PYTHON="python"
fi

mkdir -p "${DIST_DIR}"

echo "[1/3] Building ESM (45-50) from: ${ROOT_DIR}"
pushd "${ROOT_DIR}" >/dev/null
./build.sh
rm -f "${DIST_DIR}/clipflow-pro-gnome45-50.zip"
"${PYTHON}" tools/zip_dir.py build "${DIST_DIR}/clipflow-pro-gnome45-50.zip" . --exclude "schemas/gschemas.compiled"
popd >/dev/null

echo "[2/3] Building legacy (43-44) from: ${ROOT_DIR}"
pushd "${ROOT_DIR}" >/dev/null
./build-legacy.sh
rm -f "${DIST_DIR}/clipflow-pro-gnome43-44.zip"
"${PYTHON}" tools/zip_dir.py build-43-44 "${DIST_DIR}/clipflow-pro-gnome43-44.zip" . --exclude "schemas/gschemas.compiled"
popd >/dev/null

echo "[3/3] Done. Zips in ${DIST_DIR}:"
ls -lh "${DIST_DIR}"/*.zip || true
