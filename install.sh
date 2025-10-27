#!/bin/bash

# ClipFlow Pro - Installation Script
# Installs the ClipFlow Pro GNOME Shell extension into the user's profile.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
EXTENSION_UUID="clipflow-pro@nickotmazgin.github.io"
TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"

echo "ClipFlow Pro - Installation Script"
echo "=================================="
echo ""

CURRENT_DESKTOP="${XDG_CURRENT_DESKTOP:-}"
if [[ -z "${CURRENT_DESKTOP}" || "${CURRENT_DESKTOP}" != *"GNOME"* ]]; then
    echo "Warning: This extension is designed for GNOME Shell."
    echo "Detected desktop: ${CURRENT_DESKTOP:-unknown}"
    echo ""
fi

if [[ ! -d "${BUILD_DIR}" ]] || ! compgen -G "${BUILD_DIR}/*" >/dev/null; then
    echo "Build artifacts not found. Running build.sh first..."
    "${SCRIPT_DIR}/build.sh"
fi

echo "Installing ClipFlow Pro to: ${TARGET_DIR}"
rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

echo "→ Copying extension files..."
cp -r "${BUILD_DIR}/." "${TARGET_DIR}/"

if [[ -d "${TARGET_DIR}/schemas" ]]; then
    echo "→ Compiling GSettings schemas..."
    glib-compile-schemas "${TARGET_DIR}/schemas/"
else
    echo "Warning: No schemas directory found; settings may not function correctly." >&2
fi

echo ""
echo "Installation completed successfully."
echo ""

if command -v gnome-extensions >/dev/null 2>&1; then
    echo "Attempting to enable the extension..."
    if gnome-extensions enable "${EXTENSION_UUID}"; then
        echo "Extension enabled successfully!"
        echo "Restart GNOME Shell (Alt+F2 → r → Enter) if the indicator does not appear immediately."
    else
        echo "Extension could not be enabled automatically."
        echo "Enable manually via GNOME Extensions, or run:"
        echo "  gnome-extensions enable ${EXTENSION_UUID}"
    fi
else
    echo "gnome-extensions command not found."
    echo "Install the GNOME extensions CLI or enable the extension via the Extensions app."
fi

echo ""
echo "ClipFlow Pro ready to use:"
echo "  • Panel indicator shows clipboard history."
echo "  • Shortcut Super+Shift+V opens the history menu."
echo "Settings are available from the GNOME Extensions app."

echo ""
echo "Thank you for using ClipFlow Pro! 🎉"
