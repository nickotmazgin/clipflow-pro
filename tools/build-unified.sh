#!/usr/bin/env bash
set -euo pipefail

# Unified build script to produce the GNOME 45-50 distribution zip.

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST_DIR="${ROOT_DIR}/dist"
PYTHON="${PYTHON:-python3}"
if ! "${PYTHON}" --version >/dev/null 2>&1; then
  PYTHON="python"
fi

mkdir -p "${DIST_DIR}"

echo "[1/1] Building ESM (45-50) from: ${ROOT_DIR}"
pushd "${ROOT_DIR}" >/dev/null
./build.sh
rm -f "${DIST_DIR}/clipflow-pro-gnome45-50.zip"
"${PYTHON}" tools/zip_dir.py build "${DIST_DIR}/clipflow-pro-gnome45-50.zip" . --exclude "schemas/gschemas.compiled"
popd >/dev/null

echo "Done. Zip in ${DIST_DIR}:"
ls -lh "${DIST_DIR}"/*.zip || true
