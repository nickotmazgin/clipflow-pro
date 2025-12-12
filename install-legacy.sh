#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="clipflow-pro@nickotmazgin.github.io"
TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

if [[ ! -d "${SCRIPT_DIR}/build-43-44" ]]; then
  "${SCRIPT_DIR}/build-legacy.sh"
fi

echo "Installing ClipFlow Pro (43–44) to: ${TARGET_DIR}"
rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
cp -r "${SCRIPT_DIR}/build-43-44/." "${TARGET_DIR}/"

if [[ -d "${TARGET_DIR}/schemas" ]]; then
  if command -v glib-compile-schemas >/dev/null 2>&1; then
    glib-compile-schemas "${TARGET_DIR}/schemas/"
  fi
fi

if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions enable "${UUID}" || true
fi

echo "Installed. Restart GNOME Shell (Alt+F2 → r → Enter) if needed."

