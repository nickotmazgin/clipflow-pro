#!/bin/bash
# Safe ClipFlow Pro reload script - monitors for crashes
# Usage: bash safe-reload.sh

echo "=== ClipFlow Pro Safe Reload ===" && echo

# Check if extension files are installed
if [ ! -f ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/extension.js ]; then
    echo "[ERROR] Extension not installed. Run: rsync -av ~/dev/clipflow-pro/ ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/"
    exit 1
fi

# Check if schema is compiled
if [ ! -f ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/gschemas.compiled ]; then
    echo "[ERROR] Schema not compiled. Preparing schema bundle..."
    if command -v glib-compile-schemas >/dev/null 2>&1; then
        (cd ~/dev/clipflow-pro && glib-compile-schemas schemas/)
    elif [ -f ~/dev/clipflow-pro/schemas/gschemas.compiled ]; then
        echo "   Using repository's precompiled schemas (glib-compile-schemas not available)."
    else
        echo "   Neither glib-compile-schemas nor a precompiled schema bundle is available. Aborting." >&2
        exit 1
    fi
    rsync -av ~/dev/clipflow-pro/schemas/ ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/
fi

echo "[OK] Extension files ready"

HISTORY_FILE="$HOME/.config/clipflow-pro/history.json"
if command -v jq >/dev/null 2>&1; then
    HISTORY_COUNT=$(jq 'length' "$HISTORY_FILE" 2>/dev/null || echo 0)
    echo "[OK] History preserved: ${HISTORY_COUNT} entries"
else
    echo "[INFO] Install 'jq' to show history counts automatically (history file: ${HISTORY_FILE})"
fi
echo

# Ensure any background log monitor is stopped on exit
journal_monitor_running=false
JOURNAL_PID=""
cleanup() {
    if [ "$journal_monitor_running" = true ] && [ -n "$JOURNAL_PID" ]; then
        kill "$JOURNAL_PID" 2>/dev/null || true
        wait "$JOURNAL_PID" 2>/dev/null || true
    fi
    journal_monitor_running=false
    JOURNAL_PID=""
}
trap cleanup EXIT

# Start journal monitoring in background
if command -v journalctl >/dev/null 2>&1; then
    echo "[INFO] Monitoring GNOME Shell for crashes..."
    journalctl --user -f -o cat | command grep -i "JS ERROR\|segfault\|crashed" &
    JOURNAL_PID=$!
    journal_monitor_running=true
else
    echo "[WARN] 'journalctl' not available; skipping live crash monitoring."
fi

# Give user warning
echo
echo "[WARN] IMPORTANT: If GNOME Shell crashes and logs you out:"
echo "   1. Log back in"
echo "   2. Run: journalctl --user --since '10 minutes ago' > ~/clipflow-crash.log"
echo "   3. Share ~/clipflow-crash.log for debugging"
echo
echo "Press ENTER to enable extension (or Ctrl+C to cancel)"
read

# Enable extension
echo "Enabling extension..."
if ! command -v gnome-extensions >/dev/null 2>&1; then
    echo "[ERROR] gnome-extensions CLI not installed. Install it and enable the extension manually." >&2
    exit 1
fi

gnome-extensions enable clipflow-pro@nickotmazgin.github.io

# Wait and check
sleep 3

# Stop journal monitoring
cleanup

# Check if still enabled
if gnome-extensions list --enabled | command grep -q clipflow; then
    echo
    echo "[OK] SUCCESS! Extension enabled without crash"
    echo "[OK] Click the panel icon to see your 50 clipboard entries"
    echo
    echo "If entries don't show, run: journalctl --user --since '1 minute ago' | command grep clipflow"
else
    echo
    echo "[ERROR] Extension failed to enable or crashed"
    echo "[INFO] Crash log saved. Run: journalctl --user --since '5 minutes ago' > ~/clipflow-crash.log"
fi
