#!/bin/bash
# Enable ClipFlow Pro GNOME 43 extension after GNOME Shell restart

echo "Enabling ClipFlow Pro (GNOME 43)..."
gnome-extensions enable clipflow-pro-gnome43@nickotmazgin.github.io

if [ $? -eq 0 ]; then
    echo "✅ Extension enabled successfully!"
    echo ""
    echo "The extension should now appear in your panel."
    echo "If it doesn't appear, try:"
    echo "  - Alt+F2 → r → Enter (restart GNOME Shell)"
    echo "  - Or log out and log back in"
else
    echo "⚠️  Could not enable extension."
    echo "Make sure GNOME Shell has been restarted first."
fi
