#!/bin/bash
# Switch to X11 session via terminal

echo "=== Switching to X11 Session ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ This script must be run with sudo"
    echo "   Run: sudo ./switch-to-x11.sh"
    exit 1
fi

# Backup current config
echo "📋 Backing up current GDM config..."
cp /etc/gdm3/custom.conf /etc/gdm3/custom.conf.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created"

# Check current setting
CURRENT=$(grep -i "WaylandEnable" /etc/gdm3/custom.conf | grep -v "^#" | head -1)
echo ""
echo "Current setting: $CURRENT"

# Disable Wayland
echo ""
echo "🔧 Disabling Wayland (enabling X11)..."
sed -i 's/#WaylandEnable=true/WaylandEnable=false/' /etc/gdm3/custom.conf
sed -i 's/WaylandEnable=true/WaylandEnable=false/' /etc/gdm3/custom.conf

# Verify change
NEW=$(grep -i "WaylandEnable" /etc/gdm3/custom.conf | grep -v "^#" | head -1)
echo "New setting: $NEW"

echo ""
echo "✅ X11 is now enabled!"
echo ""
echo "🔄 You need to restart GDM or reboot for changes to take effect:"
echo ""
echo "   Option 1: Restart GDM (faster):"
echo "      sudo systemctl restart gdm3"
echo ""
echo "   Option 2: Reboot (safer):"
echo "      sudo reboot"
echo ""
echo "⚠️  Note: Restarting GDM will log you out immediately!"
echo ""
read -p "Do you want to restart GDM now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Restarting GDM..."
    systemctl restart gdm3
else
    echo "GDM will be restarted on next reboot."
fi







