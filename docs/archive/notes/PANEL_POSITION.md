# ClipFlow Pro - Panel Position Feature

## Overview
ClipFlow Pro respects your personal panel layout preferences. The clipboard manager icon can be positioned on the **left**, **center**, or **right** side of your GNOME panel.

## How It Works

### Default Behavior
- **Default position:** Right side of panel (next to system icons)
- **Reading:** Automatically reads your preference from settings
- **Dynamic updates:** Changes immediately when you update preferences

### Changing Panel Position

#### Method 1: Using Preferences UI
1. Click the ClipFlow Pro icon in the panel
2. Click "⚙️ Settings" button
3. Go to the **Behavior** tab
4. Find **"Panel Icon Position"**
5. Select: Left, Center, or Right
6. The icon moves **immediately** — no restart needed!

#### Method 2: Using Command Line
```bash
# Set to left
gsettings --schemadir ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas \
  set org.gnome.shell.extensions.clipflow-pro panel-position 'left'

# Set to center
gsettings --schemadir ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas \
  set org.gnome.shell.extensions.clipflow-pro panel-position 'center'

# Set to right (default)
gsettings --schemadir ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas \
  set org.gnome.shell.extensions.clipflow-pro panel-position 'right'
```

### Technical Details

#### GNOME Panel Areas
GNOME Shell's top panel has three main areas:
- **Left:** Application menu, Activities (on some systems)
- **Center:** Clock, calendar, notifications
- **Right:** System indicators (network, sound, power, etc.)

Your ClipFlow Pro icon will appear in the area you choose.

#### Position Index
The extension uses index `1` within the chosen area, which means:
- It appears near the start of that panel area
- Other extensions/indicators may appear before or after it
- GNOME Shell manages the exact pixel position automatically

#### Bottom Panel Support
**Note:** GNOME Shell typically uses a **top panel** by default. If you're using:
- **Dash to Panel extension:** ClipFlow Pro will appear in whatever panel Dash to Panel creates
- **Custom panel extensions:** Position should work automatically
- **Bottom panel (via extensions):** The left/center/right setting applies to wherever your panel is located

The extension doesn't need to detect top vs. bottom — it simply adds itself to GNOME Shell's panel, wherever that panel may be positioned by you or other extensions.

## Implementation Details

### Code Architecture
```javascript
// Read user preference
const panelPosition = this._settings.get_string('panel-position');

// Add to panel at chosen position
Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, panelPosition);

// Listen for changes
this._settings.connect('changed::panel-position', () => {
    this._updatePanelPosition();
});
```

### Dynamic Updates
When you change the position:
1. Extension detects setting change via GSettings signal
2. Destroys current indicator
3. Creates new indicator
4. Adds it to the new panel position
5. All clipboard history is preserved

## User Benefits

### For Individual Users
- **Flexibility:** Put the icon where YOU want it
- **Consistency:** Match your personal desktop layout
- **Convenience:** Change position anytime without restart

### For Different Workflows
- **Left position:** Good if you have many right-side indicators
- **Center position:** Keeps clipboard management central
- **Right position:** Traditional system tray area (default)

### For Accessibility
- Users with specific screen regions they monitor can position accordingly
- Works with screen readers and accessibility tools
- Respects user customization preferences

## Compatibility

### Works With
- ✅ GNOME Shell 42, 43, 44, 45, 46
- ✅ Zorin OS, Ubuntu, Fedora, Arch, etc.
- ✅ Wayland and X11 sessions
- ✅ Dash to Panel extension
- ✅ AppIndicator extension
- ✅ Other panel-modifying extensions

### Tested On
- GNOME Shell 43.9 (Zorin OS)
- Wayland session
- All three positions (left/center/right)

## Troubleshooting

### Icon doesn't move when changing position
1. Check if extension is still enabled:
   ```bash
   gnome-extensions info clipflow-pro@nickotmazgin.github.io
   ```
2. Check logs for errors:
   ```bash
   journalctl --user -g "clipflow" --since "1 minute ago" --no-pager
   ```
3. Try disable/enable extension:
   ```bash
   gnome-extensions disable clipflow-pro@nickotmazgin.github.io
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

### Icon appears in wrong location
- Verify your setting:
  ```bash
  gsettings --schemadir ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas \
    get org.gnome.shell.extensions.clipflow-pro panel-position
  ```
- Reset to default:
  ```bash
  gsettings --schemadir ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas \
    reset org.gnome.shell.extensions.clipflow-pro panel-position
  ```

## Future Enhancements

Potential improvements for future versions:
- [ ] Custom position index (control exact order)
- [ ] Multi-monitor support (choose which monitor's panel)
- [ ] Vertical panel support (for side panels)
- [ ] Remember position per-workspace

---

**Feature Added:** October 23, 2025  
**Version:** 1.0.0  
**Priority:** User Customization & Accessibility
