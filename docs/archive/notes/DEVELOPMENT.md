# ClipFlow Pro - Development Guide

## 🚀 Quick Start

### Prerequisites
- GNOME Shell 42+ (Ubuntu 22.04+)
- Node.js and npm (for development tools)
- Git

### Development Tools

We've created comprehensive development tools to make extension development easier:

#### 1. Node.js Development Tools (`dev-tools.js`)
```bash
# Quick build and install
node dev-tools.js deploy

# Check extension status
node dev-tools.js status

# View recent logs
node dev-tools.js logs

# Restart GNOME Shell
node dev-tools.js restart
```

#### 2. Bash Debugging Script (`debug-extension.sh`)
```bash
# Check extension status
./debug-extension.sh status

# Test extension loading
./debug-extension.sh test

# Check for common issues
./debug-extension.sh check

# Clean rebuild
./debug-extension.sh rebuild
```

## 🔧 Development Workflow

### 1. Make Changes
Edit the extension files in the project directory:
- `extension.js` - Main extension logic
- `prefs.js` - Preferences dialog
- `stylesheet.css` - UI styling
- `metadata.json` - Extension metadata
- `schemas/` - GSettings schema

### 2. Build and Install
```bash
# Quick deploy (recommended)
node dev-tools.js deploy

# Or manual build
node dev-tools.js build
node dev-tools.js install
```

### 3. Test and Debug
```bash
# Check status
./debug-extension.sh status

# View logs for errors
./debug-extension.sh logs

# Test loading
./debug-extension.sh test
```

### 4. Restart if Needed
```bash
# Restart GNOME Shell
node dev-tools.js restart

# Or logout/login
```

## 🐛 Common Issues and Solutions

### Extension Not Showing in Panel
1. **Check if enabled**: `gnome-extensions info clipflow-pro@nickotmazgin.github.io`
2. **Check logs**: `./debug-extension.sh logs`
3. **Test loading**: `./debug-extension.sh test`
4. **Restart GNOME Shell**: `node dev-tools.js restart`

### `set_spacing is not a function` Error
This is a deprecated GTK function. Replace with:
```javascript
// Old (deprecated)
container.set_spacing(10);

// New (modern)
container.spacing = 10;
```

### Extension Crashes on Load
1. **Check syntax**: `node -c extension.js`
2. **Check imports**: Ensure all GI imports are correct
3. **Check logs**: `./debug-extension.sh logs`
4. **Clean rebuild**: `./debug-extension.sh rebuild`

### Panel Position Issues
The extension respects the `panel-position` setting:
- `left` - Left side of panel
- `center` - Center of panel  
- `right` - Right side of panel

## 📁 Project Structure

```
clipflow-pro/
├── extension.js          # Main extension logic
├── prefs.js             # Preferences dialog
├── stylesheet.css       # UI styling
├── metadata.json        # Extension metadata
├── schemas/             # GSettings schema
│   └── org.gnome.shell.extensions.clipflow-pro.gschema.xml
├── locale/              # Internationalization
│   └── clipflow-pro.pot
├── dev-tools.js         # Node.js development tools
├── debug-extension.sh   # Bash debugging script
├── build/               # Build output (auto-generated)
└── DEVELOPMENT.md       # This file
```

## 🔍 Debugging Techniques

### 1. Using Looking Glass (Official GNOME Debugger)
1. Press `Alt + F2`
2. Type `lg` and press Enter
3. Go to "Extensions" tab
4. Find "ClipFlow Pro" and check for errors

### 2. Using Journal Logs
```bash
# View real-time logs
journalctl --user -f | grep -i clipflow

# View recent logs
journalctl --user --since "10 minutes ago" | grep -i clipflow
```

### 3. Using Console Logging
Add logging to your extension:
```javascript
log('ClipFlow Pro: Debug message');
console.log('Debug message');
```

### 4. Using GDB (Advanced)
```bash
# Attach to GNOME Shell process
gdb -p $(pidof gnome-shell)

# Set breakpoints
(gdb) call gjs_dumpstack()
```

## 🚀 Deployment

### For Extensions.gnome.org
1. Ensure all files are properly formatted
2. Test on multiple GNOME Shell versions
3. Follow the submission guidelines
4. Package as `.zip` file

### For GitHub
1. Create a release with proper version tags
2. Include installation instructions
3. Add screenshots and documentation

### For Flatpak
1. Create proper Flatpak manifest
2. Test in Flatpak environment
3. Follow Flatpak packaging guidelines

## 📚 Resources

- [GNOME Shell Extensions Documentation](https://gjs.guide/extensions/)
- [GNOME JavaScript Guide](https://gjs.guide/)
- [GTK Documentation](https://docs.gtk.org/)
- [GNOME Extensions Website](https://extensions.gnome.org/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

---

**Happy Coding! 🎉**

For questions or support, please open an issue on GitHub or contact the maintainers.
