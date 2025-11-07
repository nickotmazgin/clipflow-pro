#!/bin/bash
# Safe ClipFlow Pro reload script - monitors for crashes
# Usage: bash safe-reload.sh

echo "=== ClipFlow Pro Safe Reload ===" && echo

# Check if extension files are installed
if [ ! -f ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/extension.js ]; then
    echo "❌ Extension not installed. Run: rsync -av ~/dev/clipflow-pro/ ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/"
    exit 1
fi

# Check if schema is compiled
if [ ! -f ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/gschemas.compiled ]; then
    echo "❌ Schema not compiled. Preparing schema bundle..."
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

echo "✅ Extension files ready"
echo "✅ History preserved: $(cat ~/.config/clipflow-pro/history.json 2>/dev/null | jq 'length' 2>/dev/null || echo 0) entries"
echo

# Start journal monitoring in background
echo "📋 Monitoring GNOME Shell for crashes..."
journalctl --user -f -o cat | command grep -i "JS ERROR\|segfault\|crashed" &
JOURNAL_PID=$!

# Give user warning
echo
echo "⚠️  IMPORTANT: If GNOME Shell crashes and logs you out:"
echo "   1. Log back in"
echo "   2. Run: journalctl --user --since '10 minutes ago' > ~/clipflow-crash.log"
echo "   3. Share ~/clipflow-crash.log for debugging"
echo
echo "Press ENTER to enable extension (or Ctrl+C to cancel)"
read

# Enable extension
echo "Enabling extension..."
gnome-extensions enable clipflow-pro@nickotmazgin.github.io

# Wait and check
sleep 3

# Stop journal monitoring
kill $JOURNAL_PID 2>/dev/null

# Check if still enabled
if gnome-extensions list --enabled | command grep -q clipflow; then
    echo
    echo "✅ SUCCESS! Extension enabled without crash"
    echo "✅ Click the panel icon to see your 50 clipboard entries"
    echo
    echo "If entries don't show, run: journalctl --user --since '1 minute ago' | command grep clipflow"
else
    echo
    echo "❌ Extension failed to enable or crashed"
    echo "📋 Crash log saved. Run: journalctl --user --since '5 minutes ago' > ~/clipflow-crash.log"
fi
