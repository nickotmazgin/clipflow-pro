# ClipFlow Pro - Quick Test Guide

## ✅ Fixes Applied
1. **GNOME 43 compatibility** - Fixed `St.BoxLayout` spacing issue
2. **Dynamic panel position** - Reads your preference (left/center/right)

## 🔄 REQUIRED: Restart GNOME Shell
**On Wayland, you must log out and log back in.**

---

## After Login - Quick Tests (2 minutes)

### 1️⃣ Check Extension Loaded
```bash
gnome-extensions info clipflow-pro@nickotmazgin.github.io
```
Expected: `State: ENABLED`

### 2️⃣ Check for Errors
```bash
journalctl --user -g "clipflow" --since "1 minute ago" --no-pager
```
Expected: No errors (empty output or success messages only)

### 3️⃣ Find the Icon
Look for **📋 clipboard icon** in your panel.
- Default position: **right side** (near system icons)
- If not visible, check left or center

### 4️⃣ Test Basic Function
1. Click the icon → menu should open
2. Copy some text (Ctrl+C or select text)
3. Wait 2 seconds
4. Open menu again → text should appear in history

### 5️⃣ Test Panel Position
1. Open menu → click "⚙️ Settings"
2. Go to **Behavior** tab
3. Find **"Panel Icon Position"**
4. Change from Right → Left
5. **Icon should move immediately!**
6. Try Center → should move again

---

## ✅ Success Criteria
- [ ] No errors in logs
- [ ] Icon visible in panel
- [ ] Menu opens when clicked
- [ ] Copied text appears in history
- [ ] Settings open correctly
- [ ] Panel position changes work

---

## 🆘 If Something Doesn't Work

### Icon Not Visible
```bash
# Disable and re-enable
gnome-extensions disable clipflow-pro@nickotmazgin.github.io
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

### Check Detailed Logs
```bash
journalctl --user -u gnome-shell --since "5 minutes ago" --no-pager | grep -i "clipflow\|error"
```

### Reset Extension
```bash
gnome-extensions reset clipflow-pro@nickotmazgin.github.io
```

---

## 📝 Report Back

### If Everything Works ✅
Extension is ready for:
- GitHub release
- extensions.gnome.org submission
- Flatpak packaging

### If Issues Found ❌
Check `COMPLETE_AUDIT_REPORT.md` for troubleshooting

---

**Quick Test Time:** ~2 minutes  
**Full Test Time:** ~10 minutes (with all features)
