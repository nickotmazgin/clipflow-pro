#!/bin/bash

# ClipFlow Pro - Install (GNOME 43–44)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build-43-44"
UUID="clipflow-pro@nickotmazgin.github.io"
DEST="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

if [[ ! -d "${BUILD_DIR}" ]]; then
  "${SCRIPT_DIR}/build-legacy.sh"
fi

echo "Installing to ${DEST} ..."
rm -rf "${DEST}"
mkdir -p "${DEST}"
cp -r "${BUILD_DIR}/." "${DEST}/"

if [[ -d "${DEST}/schemas" ]]; then
  echo "Compiling schemas ..."
  glib-compile-schemas "${DEST}/schemas/"
fi

if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions enable "${UUID}" || true
fi

echo "Done. Restart GNOME Shell to apply (Alt+F2, r, Enter on Xorg)."
