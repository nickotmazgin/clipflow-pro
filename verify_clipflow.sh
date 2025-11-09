#!/usr/bin/env bash

set -euo pipefail

UUID="clipflow-pro@nickotmazgin.github.io"
SCHEMA_ID="org.gnome.shell.extensions.clipflow-pro"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMAS_DIR="${REPO_DIR}/schemas"
EXTENSIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
INSTALL_PATH="${EXTENSIONS_DIR}/${UUID}"

info() {
    printf '[INFO] %s\n' "$*"
}

ok() {
    printf '[ OK ] %s\n' "$*"
}

warn() {
    printf '[WARN] %s\n' "$*" >&2
}

read_metadata_value() {
    local file="$1"
    local key="$2"

    [[ -f "$file" ]] || return 1
    command -v python3 >/dev/null 2>&1 || return 1

    local result
    if result=$(
        METADATA_FILE="$file" METADATA_KEY="$key" python3 - <<'PY'
import json
import os
import sys

path = os.environ["METADATA_FILE"]
key = os.environ["METADATA_KEY"]

try:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    sys.exit(1)

value = data.get(key)
if value is None:
    sys.exit(1)

if isinstance(value, (list, dict)):
    import json as _json
    print(_json.dumps(value))
else:
    print(value)
PY
    ); then
        [[ -n "$result" ]] || return 1
        printf '%s\n' "$result"
        return 0
    fi
    return 1
}

header() {
    printf '\n== %s ==\n' "$*"
}

header "ClipFlow Pro environment verification"

repo_version="unknown"
if repo_version=$(read_metadata_value "${REPO_DIR}/metadata.json" version 2>/dev/null); then
    :
else
    repo_version="unknown"
fi

repo_version_name="unknown"
if repo_version_name=$(read_metadata_value "${REPO_DIR}/metadata.json" version-name 2>/dev/null); then
    :
else
    repo_version_name="unknown"
fi

info "Repository version: ${repo_version} (${repo_version_name})"

header "Checking local installation"
if [[ -d "$INSTALL_PATH" ]]; then
    ok "Extension found at ${INSTALL_PATH}"

    installed_version="unknown"
    if installed_version=$(read_metadata_value "${INSTALL_PATH}/metadata.json" version 2>/dev/null); then
        :
    fi

    installed_version_name="unknown"
    if installed_version_name=$(read_metadata_value "${INSTALL_PATH}/metadata.json" version-name 2>/dev/null); then
        :
    fi

    info "Installed version: ${installed_version} (${installed_version_name})"
    if [[ "$installed_version" != "unknown" && "$repo_version" != "unknown" && "$installed_version" != "$repo_version" ]]; then
        warn "Installed version differs from working tree. Run ./install.sh to sync."
    fi
else
    warn "Extension not installed yet. Run ./install.sh to deploy into your user profile."
fi

header "Validating GSettings schema"
if [[ -d "$SCHEMAS_DIR" ]]; then
    if command -v glib-compile-schemas >/dev/null 2>&1; then
        info "Compiling schemas in ${SCHEMAS_DIR}"
        glib-compile-schemas "$SCHEMAS_DIR"
        ok "Generated schemas/gschemas.compiled"
    elif [[ -f "${SCHEMAS_DIR}/gschemas.compiled" ]]; then
        warn "glib-compile-schemas not available; using existing compiled schema bundle."
    else
        warn "No compiled schema present. Install GLib development tools and re-run this script."
    fi
else
    warn "Schema directory ${SCHEMAS_DIR} is missing."
fi

header "Resetting critical settings"
if command -v gsettings >/dev/null 2>&1; then
    if schema_list=$(gsettings list-schemas 2>/dev/null); then
        if grep -qx "$SCHEMA_ID" <<<"$schema_list"; then
            for key in min-entry-length ignore-passwords; do
                if gsettings reset "$SCHEMA_ID" "$key" >/dev/null 2>&1; then
                    ok "Reset ${key} to schema default"
                else
                    warn "Failed to reset ${key}. Is GNOME Shell running under this user?"
                fi
            done
        else
            warn "Schema ${SCHEMA_ID} not installed in dconf yet. Run ./install.sh first."
        fi
    else
        warn "gsettings could not access dconf (no session bus?). Skipping resets."
    fi
else
    warn "gsettings CLI not found; cannot reset settings."
fi

header "Wayland clipboard quick test"
if command -v wl-copy >/dev/null 2>&1; then
    ok "wl-copy detected."
    printf '   Run: printf "clipflow smoke test" | wl-copy && wl-paste\n'
else
    warn "wl-copy not found. Install wl-clipboard for Wayland smoke tests."
fi

if command -v journalctl >/dev/null 2>&1; then
    printf '   Tail GNOME Shell logs with:\n'
    printf '   journalctl -f /usr/bin/gnome-shell | grep -i "ClipFlow Pro"\n'
fi

header "Self-check complete"
info "If everything looks good, rebuild with ./build.sh or package with make dist."
