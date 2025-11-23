#!/usr/bin/env bash
set -euo pipefail

# Unified build script to produce two EGO-ready zips under one UUID:
#  - clipflow-pro (ESM) for GNOME 45–47 from this repo
#  - clipflow-pro (legacy) for GNOME 43–44 from ../clipflow-pro-gnome43

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEGACY_DIR="${ROOT_DIR}-gnome43"
DIST_DIR="${ROOT_DIR}/dist"
UUID="clipflow-pro@nickotmazgin.github.io"

mkdir -p "${DIST_DIR}"

echo "[1/3] Building ESM (45–47) from: ${ROOT_DIR}"
pushd "${ROOT_DIR}" >/dev/null
./build.sh
rm -f "${DIST_DIR}/clipflow-pro-gnome45-47.zip"
(cd build && zip -r9 "${DIST_DIR}/clipflow-pro-gnome45-47.zip" .)
popd >/dev/null

echo "[2/3] Building legacy (43–44) from: ${LEGACY_DIR}"
pushd "${LEGACY_DIR}" >/dev/null
./build.sh
rm -f "${DIST_DIR}/clipflow-pro-gnome43-44.zip"
(cd build && zip -r9 "${DIST_DIR}/clipflow-pro-gnome43-44.zip" .)
popd >/dev/null

echo "[3/3] Done. Zips in ${DIST_DIR}:"
ls -lh "${DIST_DIR}"/*.zip || true

