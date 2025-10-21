# Installation Guide - ClipFlow Pro

This guide provides detailed installation instructions for ClipFlow Pro on various Linux distributions.

## Quick Install

### Method 1: From GNOME Extensions (Recommended)
```bash
# Coming soon - will be available at extensions.gnome.org
```

### Method 2: Automatic Install Script
```bash
curl -fsSL https://raw.githubusercontent.com/nickotmazgin/clipflow-pro/main/install.sh | bash
```

### Method 3: Manual Installation
```bash
# Download and extract
wget https://github.com/nickotmazgin/clipflow-pro/releases/latest/download/clipflow-pro@nickotmazgin.github.io.zip
mkdir -p ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io
unzip clipflow-pro@nickotmazgin.github.io.zip -d ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/

# Restart GNOME Shell
Alt + F2 → type 'r' → Enter

# Enable extension
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

## Build from Source

### Prerequisites
- Git
- GNOME Shell 40+
- GLib development tools
- Make

### Ubuntu/Debian
```bash
# Install dependencies
sudo apt update
sudo apt install git make glib2.0-dev gettext

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

### Fedora
```bash
# Install dependencies
sudo dnf install git make glib2-devel gettext

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

### Arch Linux
```bash
# Install dependencies
sudo pacman -S git make glib2 gettext

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

### openSUSE
```bash
# Install dependencies
sudo zypper install git make glib2-devel gettext-tools

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

## Post-Installation

### Enable the Extension
```bash
# Enable via command line
gnome-extensions enable clipflow-pro@nickotmazgin.github.io

# Or use GNOME Extensions app
# Search for "ClipFlow Pro" and toggle ON
```

### Restart GNOME Shell
- **Wayland**: Log out and back in
- **X11**: `Alt + F2`, type `r`, press Enter

### Verify Installation
```bash
# Check if extension is loaded
gnome-extensions list | grep clipflow-pro

# Check for any errors
journalctl --user -f | grep clipflow-pro
```

## Troubleshooting

### Extension Not Appearing
1. Verify GNOME Shell version compatibility:
   ```bash
   gnome-shell --version
   ```

2. Check installation path:
   ```bash
   ls -la ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
   ```

3. Compile GSettings schemas:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
   glib-compile-schemas schemas/
   ```

### Permission Issues
```bash
# Fix permissions
chmod -R 755 ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
```

### Schema Compilation Errors
```bash
# Manually compile schemas
cd ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/
glib-compile-schemas .
```

## Uninstallation

### Complete Removal
```bash
# Disable extension
gnome-extensions disable clipflow-pro@nickotmazgin.github.io

# Remove extension files
rm -rf ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/

# Remove user data (optional)
rm -rf ~/.config/clipflow-pro/
```

### Using Makefile
```bash
cd clipflow-pro/
make uninstall
```

## Advanced Installation

### System-wide Installation (Not Recommended)
```bash
# Install for all users (requires root)
sudo mkdir -p /usr/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
sudo cp -r * /usr/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
sudo glib-compile-schemas /usr/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/
```

### Development Installation
```bash
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make dev  # Installs and watches for changes
```

## Distribution-Specific Notes

### Zorin OS
- Fully supported on Zorin OS 16+ (GNOME Shell 40+)
- May require enabling "Extensions" app from Software center

### Pop!_OS
- Compatible with Pop!_OS 21.04+
- Extension integrates well with Pop Shell

### Ubuntu
- Tested on Ubuntu 20.04+ with GNOME Shell
- May need `gnome-shell-extensions` package

### Fedora Silverblue
```bash
# Layer extension via rpm-ostree (if available)
rpm-ostree install gnome-shell-extension-clipflow-pro

# Or install user-level
toolbox create dev
toolbox enter dev
# Follow normal installation steps
```

## Verification

After installation, you should see:
1. ClipFlow Pro icon in the top panel
2. Extension listed in GNOME Extensions app
3. Preferences accessible via Extensions app or extension menu

## Support

If you encounter issues:
1. Check [GitHub Issues](https://github.com/nickotmazgin/clipflow-pro/issues)
2. Review system logs: `journalctl --user -f`
3. Verify GNOME Shell compatibility
4. Join the discussion in GitHub Discussions

## Next Steps

After installation:
1. Open preferences to configure shortcuts
2. Set up auto-copy preferences
3. Enable file manager integration
4. Customize appearance settings

Enjoy using ClipFlow Pro!