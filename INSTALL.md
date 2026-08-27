# Installation Guide - ClipFlow Pro

This guide provides detailed installation instructions for ClipFlow Pro on various Linux distributions.

> **GNOME Shell 43–44 is no longer supported.** Install only the **GNOME 45–50** zip (`*-gs45-50.zip`). GNOME Shell **45** or newer is required.

> **Distribution:** ClipFlow Pro is published on **[GitHub Releases](https://github.com/nickotmazgin/clipflow-pro/releases)** only. It is **not** listed on [extensions.gnome.org](https://extensions.gnome.org), and it cannot be installed by browsing the official GNOME Extensions app catalog.

## Quick Install

### Method 1: From GitHub Releases (recommended)

1. Open the latest release: https://github.com/nickotmazgin/clipflow-pro/releases/latest
2. Download the versioned flat extension ZIP named like:
   `clipflow-pro@nickotmazgin.github.io-<version>-gs45-50.zip`
   (example for 1.5.1: `clipflow-pro@nickotmazgin.github.io-1.5.1-gs45-50.zip`)
3. Install with the GNOME Extensions CLI:

```bash
gnome-extensions install --force ~/Downloads/clipflow-pro@nickotmazgin.github.io-<version>-gs45-50.zip
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

4. Restart GNOME Shell:
   - **Wayland:** log out and back in
   - **X11:** `Alt + F2`, type `r`, press Enter

The release ZIP is a **flat** package (metadata, `extension.js`, schemas, etc. at the archive root). It does **not** contain a UUID parent directory. Prefer `gnome-extensions install --force` over manual unzip.

After install, you can enable/disable the extension in the **GNOME Extensions** app (the system extensions manager for already-installed extensions). That is different from third-party tools such as **Extension Manager**, and neither app’s “browse catalog” will find ClipFlow Pro because it is not on extensions.gnome.org.

### Method 2: Automatic Install Script (from a full clone)

**Recommended for most users:** use Method 1 (signed release ZIP).

If you prefer building from a local clone:

```bash
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
./install.sh
```

Alternatively, you can review the install script before running it from a clone:

```bash
curl -fsSL https://raw.githubusercontent.com/nickotmazgin/clipflow-pro/main/install.sh -o /tmp/clipflow-install.sh
less /tmp/clipflow-install.sh   # review before running
```

Note: `install.sh` expects to run from (or next to) a full repository checkout that includes `build.sh` and the extension sources. Prefer cloning the repo, then running `./install.sh` from that directory.

This script never touches system directories; everything is installed into `~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/`, so it works even on systems where `sudo` is highly locked down.

### Method 3: Manual Installation from the release ZIP

```bash
# Download the versioned flat ZIP from the latest release assets page, then:
ZIP=~/Downloads/clipflow-pro@nickotmazgin.github.io-<version>-gs45-50.zip

# Preferred:
gnome-extensions install --force "$ZIP"

# Or unzip into the UUID directory yourself (ZIP contents are flat — no UUID folder inside):
mkdir -p ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io
unzip -o "$ZIP" -d ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/

# Enable
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

Restart GNOME Shell after installing (Wayland: log out/in; X11: `Alt+F2` → `r`).

## Rootless workflow (no sudo required)

ClipFlow Pro is intentionally designed to be built, installed, and updated entirely inside your home directory. If an aggressive sudoers policy kicks you out of the shell or blocks commands, keep everything confined to `~/.local` and `~/.config`:

```bash
# Stay in your home directory
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro

# Build + install without elevated privileges
./build.sh            # or: make build
./install.sh          # or: make install

# Enable after restarting GNOME Shell
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

Both scripts copy files under your user profile. `install.sh` runs `glib-compile-schemas` inside the installed extension directory. No system-wide writes occur, so sudo is never invoked for the install itself. If you need distro packages such as `glib2` or `gettext` but cannot use sudo, install them via a user-level toolbox/Flatpak/Nix/conda environment and run the commands inside that sandbox. Once those packages are available in `$PATH`, the rest of the workflow remains rootless.

### Schema compilation

Release and build packages ship the GSettings **XML** schema only. They do **not** ship `schemas/gschemas.compiled` (`build.sh` explicitly excludes compiled schemas).

You need `glib-compile-schemas` available when installing from source (`./install.sh` / `make install`). If the compiler is missing and no compiled schema is present in the install directory, install fails with a clear error.

After a manual unzip install, compile schemas yourself:

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/
```

If you edit `schemas/*.gschema.xml` during development, run `glib-compile-schemas schemas/` (or reinstall) so the installed extension picks up the change.

## Build from Source

### Prerequisites
- Git
- GNOME Shell **45–50**
- GLib development tools (including `glib-compile-schemas`)
- Make

> The commands below that start with `sudo` are only for installing missing build dependencies via your distro's package manager. The actual `make build`, `make install`, and `install.sh` steps never require elevated privileges—feel free to skip the dependency install commands if you already have the tools available or you are working inside a rootless development container.

### Create a package for distribution
```bash
make dist   # Creates dist/clipflow-pro@nickotmazgin.github.io.shell-extension.zip (+ source zip)
# Or pack with the official tool from build/
make pack
```

GitHub release assets use the versioned name:
`clipflow-pro@nickotmazgin.github.io-<version>-gs45-50.zip` (produced by the release packaging scripts).

Note: GNOME Shell extensions are not distributed as Flatpaks.

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

Requires a GNOME Shell **45–50** session to run the extension.

### Fedora
```bash
# Install dependencies
sudo dnf install git make glib2-devel gettext

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

Requires a GNOME Shell **45–50** session to run the extension.

### Arch Linux
```bash
# Install dependencies
sudo pacman -S git make glib2 gettext

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

Requires a GNOME Shell **45–50** session to run the extension.

### openSUSE
```bash
# Install dependencies
sudo zypper install git make glib2-devel gettext-tools

# Clone and build
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

Requires a GNOME Shell **45–50** session to run the extension.

## Post-Installation

### Enable the Extension

**Via GNOME Extensions App (already-installed extensions):**
1. Open the **GNOME Extensions** app
2. Find **ClipFlow Pro** in the installed list
3. Toggle the switch to **ON**

**Via Command Line:**
```bash
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

### Restart GNOME Shell
- **Wayland**: Log out and back in
- **X11**: `Alt + F2`, type `r`, press Enter

### Configuration Files
- Clipboard history is stored at `~/.config/clipflow-pro/history.json`.
- Remove that file (or the entire directory) if you want to reset ClipFlow Pro's history.

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
   ClipFlow Pro requires GNOME Shell **45–50**.

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
If your sudo policy is restrictive or managed by IT, skip this section—ClipFlow Pro works when installed in your home directory.
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

ClipFlow Pro targets **GNOME Shell 45–50** only. Older GNOME releases (including Shell 40–44) are not supported.

### Zorin OS
- Use a Zorin release that ships GNOME Shell **45–50**
- You may need the Extensions app from Software to enable already-installed extensions

### Pop!_OS
- Compatible when the session runs GNOME Shell **45–50**

### Ubuntu
- Use an Ubuntu release with GNOME Shell **45–50**
- You may need the `gnome-shell-extensions` package for the Extensions app / CLI

### Fedora Silverblue
```bash
# User-level install inside a toolbox (recommended)
toolbox create dev
toolbox enter dev
# Follow Method 1 or the rootless clone workflow above
```

## Verification

After installation, you should see:
1. ClipFlow Pro icon in the top panel
2. Extension listed in the GNOME Extensions app (installed list)
3. Preferences accessible via the Extensions app or extension menu

## Support

If you encounter issues:
1. Check [GitHub Issues](https://github.com/nickotmazgin/clipflow-pro/issues)
2. Review system logs: `journalctl --user -f`
3. Verify GNOME Shell compatibility (**45–50**)
4. Join the discussion in GitHub Discussions

## Next Steps

After installation:
1. Open preferences to configure shortcuts
2. Set up auto-copy preferences
3. Customize appearance settings

Enjoy using ClipFlow Pro!
