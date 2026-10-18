#!/usr/bin/env python3
"""Capture ClipFlow Pro gallery screenshots and an HD demo video (GNOME on X11).

Subcommands:
  screenshots   Window/menu PNGs into screenshots/v<version>/ (+ optional collage)
  video         1080p H.264 demo with captions into dist/media/
  all           Both, in one session
  restore       Re-apply the most recent backup (if a run was interrupted)

Privacy guarantees while capturing:
  * Your real history, clipboard and ClipFlow settings are backed up and replaced
    with demo-only data, then restored (also on Ctrl+C / errors).
  * Capture happens on an empty workspace; desktop icons are hidden and
    notification banners are turned off for the duration.
  * Screenshots are cropped to the ClipFlow window or menu only.
  * In the video, the taskbar/panel is blurred except a small area around the
    ClipFlow icon (clock, tray, other apps are unreadable).

Requirements: X11 session, xdotool, wmctrl, xclip, ffmpeg (video), gjs,
python3-pil. Your mouse and keyboard are driven while it runs — don't touch them.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageGrab

sys.path.insert(0, str(Path(__file__).resolve().parent))
from demo_entries import DEMO_ENTRIES  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
MEDIA_DIR = Path(__file__).resolve().parent
UUID = 'clipflow-pro@nickotmazgin.github.io'
SCHEMA = 'org.gnome.shell.extensions.clipflow-pro'
DCONF_PATH = '/org/gnome/shell/extensions/clipflow-pro/'
HISTORY_FILE = Path.home() / '.config' / 'clipflow-pro' / 'history.json'
BACKUP_ROOT = Path.home() / '.cache' / 'clipflow-pro-media'
RECENT_MENU_KEYS = '<Super><Alt><Shift>F9'
RECENT_MENU_XDO = 'super+alt+shift+F9'
HISTORY_WINDOW_KEYS = '<Super><Alt><Shift>F10'
HISTORY_WINDOW_XDO = 'super+alt+shift+F10'
HISTORY_TITLE = 'ClipFlow Pro — History'
PREFS_TABS = ['general', 'behavior', 'appearance', 'shortcuts', 'about']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


# ---------------------------------------------------------------- helpers

def run(*args, check=True, capture=False, inp=None):
    res = subprocess.run(args, check=check, text=True, input=inp,
                         stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                         stderr=subprocess.PIPE if capture else subprocess.DEVNULL)
    return res.stdout.strip() if capture else res.returncode


def out(*args):
    return run(*args, check=False, capture=True)


def log(msg):
    print(f'[media] {msg}', flush=True)


def gset(key, value):
    run('gsettings', 'set', SCHEMA, key, value)


# Windows that belong to the demo; everything else is the user's and stays hidden.
DEMO_TITLES = (HISTORY_TITLE, 'ClipFlow Pro', 'Demo — text to copy')
DEMO_CLASSES = ('org.gnome.Shell.Extensions', 'gjs.Gjs', 'gnome-shell')


def user_windows():
    """Visible, non-demo app windows (any workspace): (id, class)."""
    found = []
    for line in out('wmctrl', '-lx').splitlines():
        parts = line.split(None, 4)
        if len(parts) < 4 or parts[1] == '-1':
            continue
        wid, cls = parts[0], parts[2]
        title = parts[4] if len(parts) > 4 else ''
        if title in DEMO_TITLES or cls in DEMO_CLASSES:
            continue
        if '_NET_WM_STATE_HIDDEN' in out('xprop', '-id', wid, '_NET_WM_STATE'):
            continue
        found.append((wid, cls))
    return found


def ensure_private():
    """Keep the user's apps (chat, browser, terminals) out of shots and keystrokes.

    Apps can raise themselves mid-run; if one has, minimise it again before
    any key press or capture, so Escape or typed text never lands in it.
    """
    for wid, cls in user_windows():
        log(f'hiding {cls} again before continuing')
        run('xdotool', 'windowminimize', '--sync', wid, check=False)
    time.sleep(0.05)


def key(combo):
    ensure_private()
    run('xdotool', 'key', '--clearmodifiers', combo, check=False)


def type_text(text, delay):
    ensure_private()
    run('xdotool', 'type', '--delay', str(delay), text, check=False)


def version():
    meta = json.loads((REPO / 'metadata.json').read_text(encoding='utf-8'))
    return (meta.get('version-name') or '').split()[0]


def grab():
    ensure_private()
    try:
        return ImageGrab.grab().convert('RGB')
    except Exception:
        data = subprocess.run(['import', '-window', 'root', 'png:-'],
                              check=True, stdout=subprocess.PIPE).stdout
        from io import BytesIO
        return Image.open(BytesIO(data)).convert('RGB')


def work_area():
    # "0  * DG: 1920x1080  VP: 0,0  WA: 0,0 1920x1020  Workspace 1"
    for line in out('wmctrl', '-d').splitlines():
        if ' * ' in line:
            wa = line.split('WA:')[1].split()
            x, y = map(int, wa[0].split(','))
            w, h = map(int, wa[1].split('x'))
            return x, y, w, h
    return 0, 0, 1920, 1080


def screen_size():
    img = grab()
    return img.size


def find_window(title, timeout=10.0, exact=True):
    pattern = f'^{title}$' if exact else title
    end = time.time() + timeout
    while time.time() < end:
        ids = out('xdotool', 'search', '--onlyvisible', '--name', pattern).split()
        if ids:
            return ids[-1]
        time.sleep(0.2)
    raise RuntimeError(f'window not found: {title!r}')


def window_closed(wid, timeout=5.0):
    end = time.time() + timeout
    while time.time() < end:
        if run('xdotool', 'getwindowname', wid, check=False) != 0:
            return True
        time.sleep(0.2)
    return False


def frame_extents(wid):
    raw = out('xprop', '-id', wid, '_GTK_FRAME_EXTENTS')
    if '=' not in raw:
        return 0, 0, 0, 0
    vals = [int(v) for v in raw.split('=')[1].split(',')]
    return tuple(vals)  # left, right, top, bottom


def window_rect(wid):
    info = out('xwininfo', '-id', wid)
    vals = {}
    for line in info.splitlines():
        line = line.strip()
        for k in ('Absolute upper-left X', 'Absolute upper-left Y', 'Width', 'Height'):
            if line.startswith(k + ':'):
                vals[k] = int(line.split(':')[1])
    left, right, top, bottom = frame_extents(wid)
    x = vals['Absolute upper-left X'] + left
    y = vals['Absolute upper-left Y'] + top
    return x, y, vals['Width'] - left - right, vals['Height'] - top - bottom


def scroll_to_bottom(wid, step_delay=0.25, max_steps=80):
    """Scroll a window's content down at a readable pace until it stops moving."""
    x, y, w, h = window_rect(wid)
    run('xdotool', 'mousemove', str(x + w // 4), str(y + h // 2 + 60), check=False)
    # Compare only the middle of the content: the scrollbar and the edge glow
    # keep changing at the bottom, the content itself does not.
    box = (x + w // 10, y + h // 4, x + w * 7 // 10, y + h * 3 // 4)
    prev = grab().crop(box)
    for _ in range(max_steps):
        ensure_private()
        run('xdotool', 'click', '5', check=False)
        time.sleep(step_delay)
        cur = grab().crop(box)
        if ImageChops.difference(cur, prev).getbbox() is None:
            break
        prev = cur


def place_window(wid, width, height):
    ax, ay, aw, ah = work_area()
    width, height = min(width, aw - 40), min(height, ah - 40)
    x = ax + (aw - width) // 2
    y = ay + (ah - height) // 2
    run('wmctrl', '-i', '-r', wid, '-b', 'remove,maximized_vert,maximized_horz', check=False)
    run('xdotool', 'windowsize', wid, str(width), str(height), check=False)
    time.sleep(0.3)
    left, right, top, bottom = frame_extents(wid)
    run('xdotool', 'windowmove', wid, str(x - left), str(y - top), check=False)
    run('xdotool', 'windowactivate', '--sync', wid, check=False)
    time.sleep(0.8)


def rounded(img, radius=14):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius, fill=255)
    rgba = img.convert('RGBA')
    rgba.putalpha(mask)
    return rgba


def save_window(wid, path):
    time.sleep(0.4)
    x, y, w, h = window_rect(wid)
    img = grab().crop((x, y, x + w, y + h))
    rounded(img).save(path)
    log(f'saved {path.relative_to(REPO) if path.is_relative_to(REPO) else path}')


def diff_regions(before, after, panel_band):
    """Return (menu_bbox, icon_x_range) from two full-screen shots."""
    diff = ImageChops.difference(before, after).convert('L').point(lambda v: 255 if v > 24 else 0)
    py0, py1 = panel_band
    w, h = diff.size
    body = diff.copy()
    ImageDraw.Draw(body).rectangle([0, py0, w, py1], fill=0)
    menu = body.getbbox()
    band = diff.crop((0, py0, w, py1))
    cols = [x for x in range(w) if band.crop((x, 0, x + 1, py1 - py0)).getbbox()]
    runs, start, prev = [], None, None
    for x in cols:
        if start is None:
            start = prev = x
        elif x - prev > 12:
            runs.append((start, prev))
            start = x
        prev = x
    if start is not None:
        runs.append((start, prev))
    icon = None
    if runs:
        target = (menu[0] + menu[2]) / 2 if menu else w / 2
        icon = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - target))
    return menu, icon


def _icon_template():
    """Alpha mask of the panel icon (theme 'edit-paste-symbolic'), or None."""
    path = out(sys.executable, '-c',
               "import gi; gi.require_version('Gtk', '3.0'); from gi.repository import Gtk; "
               "i = Gtk.IconTheme.get_default().lookup_icon('edit-paste-symbolic', 16, 0); "
               "print(i.get_filename() if i else '')")
    if not path or not shutil.which('convert'):
        return None
    png = Path(tempfile.mkdtemp(prefix='clipflow-icon-')) / 'icon.png'
    if run('convert', '-background', 'none', '-density', '1200', path, '-resize', '64x64', str(png), check=False):
        return None
    import numpy as np
    return np.asarray(Image.open(png).convert('RGBA'))[:, :, 3].astype(float)


def locate_icon(shot, panel_band, near_x, template, span=100):
    """Template-match the panel icon within +-span px of near_x. Returns centre x or None."""
    import numpy as np
    from numpy.lib.stride_tricks import sliding_window_view
    x0 = max(0, near_x - span)
    band = np.asarray(shot.convert('L').crop((x0, panel_band[0], near_x + span, panel_band[1]))).astype(float)
    best = (0.0, None)
    for size in range(12, 25):
        t = np.asarray(Image.fromarray(template.astype('uint8')).resize((size, size), Image.LANCZOS)).astype(float)
        t = (t - t.mean()) / (t.std() + 1e-6)
        win = sliding_window_view(band, (size, size))
        mean = win.mean(axis=(2, 3), keepdims=True)
        std = win.std(axis=(2, 3), keepdims=True) + 1e-6
        ncc = (((win - mean) / std) * t).mean(axis=(2, 3))
        y, x = np.unravel_index(ncc.argmax(), ncc.shape)
        if ncc[y, x] > best[0]:
            best = (float(ncc[y, x]), x0 + x + size // 2)
    return best[1] if best[0] >= 0.6 else None


# ---------------------------------------------------------------- session

class Session:
    """Backs up user state, applies demo state, and always restores."""

    def __init__(self):
        self.dir = BACKUP_ROOT / time.strftime('backup-%Y%m%d-%H%M%S')
        self.state = {}
        self.children = []

    # -- backup / restore
    def backup(self):
        # An interrupted run (killed before restoring) leaves demo state behind;
        # put the real state back first so it is never mistaken for yours.
        latest = BACKUP_ROOT / 'latest'
        if (latest / 'IN_PROGRESS').exists():
            log('previous run was interrupted; restoring its backup first')
            Session.restore_from(latest)
        self.dir.mkdir(parents=True, exist_ok=True)
        os.chmod(self.dir, 0o700)
        if HISTORY_FILE.exists():
            shutil.copy2(HISTORY_FILE, self.dir / 'history.json')
        (self.dir / 'settings.dconf').write_text(out('dconf', 'dump', DCONF_PATH) + '\n')
        clip = subprocess.run(['xclip', '-o', '-selection', 'clipboard'],
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
        desktop_icons = [line.strip() for line in out('gnome-extensions', 'list', '--enabled').splitlines()
                         if 'desktop-icons' in line or line.startswith('ding@')]
        self.state = {
            'history': HISTORY_FILE.exists(),
            'clipboard_b64': base64.b64encode(clip).decode(),
            'banners': out('gsettings', 'get', 'org.gnome.desktop.notifications', 'show-banners'),
            'desktop_icons': desktop_icons,
            'workspace': int(out('xdotool', 'get_desktop') or 0),
            # Other clipboard managers (e.g. CopyQ with a ClipFlow sync command)
            # would write extra entries into the demo history.
            'copyq_monitoring': out('copyq', 'monitoring') == 'true' if shutil.which('copyq') else False,
        }
        (self.dir / 'state.json').write_text(json.dumps(self.state))
        (self.dir / 'IN_PROGRESS').touch()
        if latest.is_symlink() or latest.exists():
            latest.unlink()
        latest.symlink_to(self.dir.name)
        log(f'backed up your history, settings and clipboard to {self.dir}')

    @staticmethod
    def restore_from(bdir):
        bdir = Path(bdir).resolve()
        state = json.loads((bdir / 'state.json').read_text())
        run('dconf', 'reset', '-f', DCONF_PATH, check=False)
        run('dconf', 'load', DCONF_PATH, inp=(bdir / 'settings.dconf').read_text(), check=False)
        # Let ClipFlow flush any queued demo save before putting history back.
        time.sleep(3)
        for _attempt in range(3):
            if state['history']:
                _write_private(HISTORY_FILE, (bdir / 'history.json').read_bytes())
            time.sleep(3)
            if not state['history'] or HISTORY_FILE.read_bytes() == (bdir / 'history.json').read_bytes():
                break
        # xclip keeps running to serve the selection; detach its output.
        subprocess.run(['xclip', '-selection', 'clipboard'], input=base64.b64decode(state['clipboard_b64']),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        run('gsettings', 'set', 'org.gnome.desktop.notifications', 'show-banners', state['banners'], check=False)
        for ext in state['desktop_icons']:
            run('gnome-extensions', 'enable', ext, check=False)
        if state.get('copyq_monitoring'):
            run('copyq', 'enable', check=False)
        run('wmctrl', '-s', str(state['workspace']), check=False)
        for wid in state.get('minimized', []):
            run('xdotool', 'windowactivate', '--sync', str(int(wid, 16)), check=False)
        (bdir / 'IN_PROGRESS').unlink(missing_ok=True)
        log('restored your history, settings, clipboard, notifications, desktop icons, windows and workspace')

    # -- demo state
    def enter_demo(self, seed=True):
        # Privacy: no banners, no desktop icons, empty workspace.
        run('gsettings', 'set', 'org.gnome.desktop.notifications', 'show-banners', 'false')
        if self.state.get('copyq_monitoring'):
            run('copyq', 'disable', check=False)
        for ext in self.state['desktop_icons']:
            run('gnome-extensions', 'disable', ext, check=False)
        # Minimise every app window (restored afterwards, active one last).
        active = out('xdotool', 'getactivewindow')
        hidden = [wid for wid, _cls in user_windows()]
        active_hex = f'0x{int(active):08x}' if active.isdigit() else ''
        hidden.sort(key=lambda w: int(w, 16) == int(active_hex, 16) if active_hex else False)
        # 'all' enters demo twice; keep the first (real) list.
        self.state['minimized'] = self.state.get('minimized', []) + [w for w in hidden if w not in self.state.get('minimized', [])]
        (self.dir / 'state.json').write_text(json.dumps(self.state))
        for wid in hidden:
            run('xdotool', 'windowminimize', '--sync', wid, check=False)
        n = int(out('xprop', '-root', '_NET_NUMBER_OF_DESKTOPS').split('=')[1])
        run('wmctrl', '-s', str(n - 1))
        time.sleep(0.8)
        busy = [l for l in out('wmctrl', '-l').splitlines() if l.split()[1] == str(n - 1)]
        if busy:
            log(f'warning: workspace {n} is not empty ({len(busy)} windows); screenshots are cropped anyway')
        run('xdotool', 'mousemove', '960', '400', check=False)
        # Temporary, collision-unlikely shortcuts (your own are restored afterwards).
        gset('open-recent-menu-shortcut', f"['{RECENT_MENU_KEYS}']")
        gset('show-history-window-shortcut', f"['{HISTORY_WINDOW_KEYS}']")
        gset('show-copy-notifications', 'false')
        gset('panel-left-click-action', "'history-window'")
        gset('max-entries', '50')
        gset('entries-per-page', '10')
        write_history(DEMO_ENTRIES if seed else [])
        time.sleep(2)

    def spawn(self, *args):
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.children.append(proc)
        return proc

    def cleanup_windows(self):
        for proc in self.children:
            if proc.poll() is None:
                proc.terminate()
        for title in (HISTORY_TITLE, 'ClipFlow Pro', 'Demo — text to copy'):
            for wid in out('xdotool', 'search', '--name', f'^{title}$').split():
                run('wmctrl', '-i', '-c', wid, check=False)
        key('Escape')


def _write_private(path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


def write_history(entries):
    now = int(time.time())
    items = []
    # entries are oldest -> newest; history.json is newest first
    for age, (text, pinned, starred) in enumerate(reversed(entries)):
        items.append({'id': str(uuid.uuid4()), 'text': text, 'timestampUnix': now - age * 97,
                      'pinned': pinned, 'starred': starred, 'sensitive': False})
    _write_private(HISTORY_FILE, json.dumps(items).encode())


# ---------------------------------------------------------------- captures

class Capturer:
    def __init__(self, session):
        self.s = session
        ax, ay, aw, ah = work_area()
        sw, sh = screen_size()
        self.panel_band = (ay + ah, sh) if ay == 0 and ay + ah < sh else (0, ay)
        self.icon = None  # (x0, x1) of the ClipFlow panel icon

    def open_recent_menu(self):
        menu = None
        for attempt in range(3):
            if attempt:
                # Re-register the temporary shortcut; ClipFlow can miss a quick change.
                log(f'recent menu did not open (attempt {attempt}); retrying')
                gset('open-recent-menu-shortcut', '[]')
                time.sleep(1.0)
                gset('open-recent-menu-shortcut', f"['{RECENT_MENU_KEYS}']")
                time.sleep(1.5 * attempt)
            run('xdotool', 'mousemove', '960', '300', check=False)
            time.sleep(0.4)
            before = grab()
            key(RECENT_MENU_XDO)
            time.sleep(1.2)
            menu, _ = diff_regions(before, grab(), self.panel_band)
            if menu:
                break
        sw, _sh = screen_size()
        # GNOME centres a panel menu on its source icon unless clamped at a screen edge.
        if menu and menu[0] > 4 and menu[2] < sw - 4:
            cx = (menu[0] + menu[2]) // 2
            # The menu is only roughly centred; pin the icon down by matching it.
            template = _icon_template()
            exact = locate_icon(before, self.panel_band, cx, template) if template is not None else None
            cx = exact or cx
            self.icon = (cx - 8, cx + 8)
        log(f'recent menu bbox={menu} icon={self.icon}')
        return menu

    def open_panel_menu(self):
        if not self.icon:
            self.open_recent_menu()
            key('Escape')
            time.sleep(0.6)
        if not self.icon:
            log('could not locate the ClipFlow panel icon; skipping left-click menu')
            return None
        gset('panel-left-click-action', "'panel-menu'")
        cx = (self.icon[0] + self.icon[1]) // 2
        cy = (self.panel_band[0] + self.panel_band[1]) // 2
        menu = None
        for attempt in range(3):
            # Give ClipFlow time to pick up the setting change before clicking.
            time.sleep(1.0 + attempt)
            run('xdotool', 'mousemove', str(cx), str(cy), check=False)
            time.sleep(0.6)
            before = grab()
            self.desktop = before
            run('xdotool', 'click', '1', check=False)
            time.sleep(1.2)
            menu, _ = diff_regions(before, grab(), self.panel_band)
            if menu:
                break
            log(f'panel menu did not open (attempt {attempt + 1}); retrying')
        # Safety: only accept a menu centred on the ClipFlow icon; never another
        # tray menu (those can show Wi-Fi names, battery, etc.).
        log(f'left-click at x={cx}: menu bbox={menu}')
        centred = menu and abs((menu[0] + menu[2]) // 2 - cx) <= 24
        left_aligned = menu and menu[0] - 30 <= cx <= menu[0] + 90
        if not (centred or left_aligned):
            log('left-click menu did not open on the ClipFlow icon; skipping it')
            key('Escape')
            return None
        return menu

    def menu_box(self, rough):
        """Tight box of the panel menu inside a rough diff box (drops slide-in noise)."""
        x0, y0, x1, y1 = rough
        img = grab().crop(rough)
        w, h = img.size
        seed = img.getpixel((w - 60, h - 40))  # inside the bottom ("Actions") row
        px = img.load()
        near = lambda c: all(abs(c[i] - seed[i]) <= 10 for i in range(3))
        cols = [x for x in range(0, w, 2) if sum(near(px[x, y]) for y in range(0, h, 6)) > 0.3 * h / 6]
        rows = [y for y in range(0, h, 2) if sum(near(px[x, y]) for x in range(0, w, 6)) > 0.3 * w / 6]
        if not cols or not rows:
            return rough
        return (x0 + cols[0], y0 + rows[0], x0 + cols[-1], y0 + rows[-1])

    def menu_open(self, box):
        cur = grab().crop(box)
        return ImageChops.difference(cur, self.desktop.crop(box)).getbbox() is not None

    @staticmethod
    def first_row_dots(box, shot):
        """Centre of the top-most ⋮ button: three small light dots stacked vertically."""
        px = shot.load()
        found = []
        for x in range(box[2] - 110, box[2] - 60):
            ys = [y for y in range(box[1] + 40, box[3] - 60) if sum(px[x, y][:3]) > 450]
            blobs = []
            for y in ys:
                if blobs and y - blobs[-1][-1] <= 1:
                    blobs[-1].append(y)
                else:
                    blobs.append([y])
            centres = [(b[0] + b[-1]) // 2 for b in blobs if len(b) <= 4]
            for a, b, c in zip(centres, centres[1:], centres[2:]):
                if 3 <= b - a <= 9 and 3 <= c - b <= 9:
                    found.append((x, b))
                    break
        if not found:
            return None
        # Top row only; the ⋮ is the right-most icon there (copy sits to its left).
        top = min(y for _x, y in found)
        row = [(x, y) for x, y in found if y - top <= 8]
        xs = [x for x, _y in row if x >= max(x for x, _y in row) - 4]
        return ((min(xs) + max(xs)) // 2, top + 1)

    def open_row_menu(self, box):
        """Click the ⋮ button of the first row; returns the menu + popup box."""
        before = grab()
        dots = self.first_row_dots(box, before)
        if not dots:
            log('could not find a ⋮ button in the panel menu; skipping the clip menu')
            return None
        run('xdotool', 'mousemove', *map(str, dots), check=False)
        time.sleep(0.5)
        run('xdotool', 'click', '1', check=False)
        time.sleep(1.0)
        pop, _ = diff_regions(before, grab(), self.panel_band)
        if not pop:
            return None
        return (min(box[0], pop[0]), min(box[1], pop[1]), max(box[2], pop[2]), max(box[3], pop[3]))

    def expand_actions(self, box):
        """Open the Actions submenu at the bottom of the panel menu; returns the grown box."""
        run('xdotool', 'mousemove', str(box[0] + 60), str(box[3] - 30), check=False)
        time.sleep(0.4)
        run('xdotool', 'click', '1', check=False)
        time.sleep(1.2)
        grown, _ = diff_regions(self.desktop, grab(), self.panel_band)
        top = grown[1] if grown else box[1]
        return (box[0], min(top, box[1]), box[2], box[3])

    def close_menu(self):
        key('Escape')
        time.sleep(0.5)
        gset('panel-left-click-action', "'history-window'")
        run('xdotool', 'mousemove', '960', '300', check=False)

    def shot_region(self, bbox, path, pad=10):
        sw, sh = screen_size()
        x0, y0, x1, y1 = bbox
        box = (max(0, x0 - pad), max(0, y0 - pad), min(sw, x1 + pad), min(self.panel_band[0], y1 + pad)
               if self.panel_band[0] > 0 else min(sh, y1 + pad))
        grab().crop(box).save(path)
        log(f'saved {path.relative_to(REPO)}')

    def open_history_window(self):
        key(HISTORY_WINDOW_XDO)
        wid = find_window(HISTORY_TITLE, timeout=12)
        place_window(wid, 1500, 900)
        return wid

    def history_points(self, wid):
        x, y, w, h = window_rect(wid)
        return {
            'search': (x + 220, y + 47 + 26),
            'row1': (x + w // 2, y + 47 + 56 + 26),
            'row2': (x + w // 2, y + 47 + 56 + 80),
        }

    def open_prefs(self, tab):
        gset('target-prefs-tab', f"'{tab}'")
        self.s.spawn('gnome-extensions', 'prefs', UUID)
        wid = find_window('ClipFlow Pro', timeout=15)
        place_window(wid, 1100, 1000)
        time.sleep(0.8)
        return wid


def take_screenshots(session, outdir, collage=True):
    cap = Capturer(session)
    outdir.mkdir(parents=True, exist_ok=True)
    for old in outdir.glob('*.png'):
        old.unlink()

    write_history(DEMO_ENTRIES)
    time.sleep(2)
    wid = cap.open_history_window()
    save_window(wid, outdir / '01-history-window.png')
    pts = cap.history_points(wid)
    run('xdotool', 'mousemove', *map(str, pts['search']), 'click', '1', check=False)
    time.sleep(0.3)
    type_text('invoice', 60)
    time.sleep(1.0)
    save_window(wid, outdir / '02-history-search.png')
    key('ctrl+a')
    key('BackSpace')
    time.sleep(0.6)
    run('xdotool', 'mousemove', *map(str, pts['row2']), 'click', '3', check=False)
    time.sleep(1.0)
    save_window(wid, outdir / '03-history-row-actions.png')
    key('Escape')
    time.sleep(0.4)
    run('wmctrl', '-i', '-c', wid, check=False)
    window_closed(wid)

    menu = cap.open_recent_menu()
    if menu:
        cap.shot_region(menu, outdir / '04-panel-recent-menu.png')
    cap.close_menu()
    time.sleep(0.6)
    menu = cap.open_panel_menu()
    if menu:
        box = cap.menu_box(menu)
        cap.shot_region(box, outdir / '05-panel-menu.png')
        both = cap.open_row_menu(box)
        if both:
            cap.shot_region(both, outdir / '06-panel-row-menu.png')
        key('Escape')
        time.sleep(0.6)
        if not cap.menu_open(box):
            menu = cap.open_panel_menu()
            box = cap.menu_box(menu) if menu else None
        if box:
            cap.shot_region(cap.expand_actions(box), outdir / '07-panel-actions.png')
    cap.close_menu()

    for i, tab in enumerate(PREFS_TABS, start=8):
        wid = cap.open_prefs(tab)
        save_window(wid, outdir / f'{i:02d}-settings-{tab}.png')
        run('wmctrl', '-i', '-c', wid, check=False)
        window_closed(wid)
        time.sleep(0.5)

    if collage:
        target = REPO / 'screenshots' / f'collage-v{version()}.png'
        run(sys.executable, str(REPO / 'tools' / 'make_collage_2026.py'), 'clipflow', str(outdir), str(target),
            check=False)
        if target.exists():
            log(f'saved {target.relative_to(REPO)}')


# ---------------------------------------------------------------- video

TOOLS_DIR = Path(os.environ.get('CLIPFLOW_MEDIA_TOOLS', Path.home() / '.cache' / 'clipflow-pro-media-tools'))


class Voice:
    """Narration clips from Kokoro, cached by voice, speed and text."""

    def __init__(self):
        from narration import NARRATION, SPEED, VOICE
        self.lines, self.voice, self.speed = NARRATION, VOICE, SPEED
        self.dir = TOOLS_DIR / 'tts-cache' / f'{VOICE}-{SPEED}'
        self.files, self.lengths = {}, {}

    @staticmethod
    def available():
        py = TOOLS_DIR / 'venv' / 'bin' / 'python'
        return py.exists() and (TOOLS_DIR / 'kokoro-v1.0.onnx').exists()

    def prepare(self):
        import hashlib
        self.dir.mkdir(parents=True, exist_ok=True)
        todo = {}
        for key, text in self.lines.items():
            h = hashlib.sha1(text.encode()).hexdigest()[:12]
            self.files[key] = self.dir / f'{h}.wav'
            if not self.files[key].exists():
                todo[h] = text
        if todo:
            log(f'speaking {len(todo)} narration line(s) with Kokoro ({self.voice}); this takes a few minutes')
            lines = self.dir / 'todo.json'
            lines.write_text(json.dumps(todo), encoding='utf-8')
            run(str(TOOLS_DIR / 'venv' / 'bin' / 'python'), str(MEDIA_DIR / 'tts_kokoro.py'),
                str(lines), str(self.dir), self.voice, str(self.speed))
            lines.unlink()
        for key, path in self.files.items():
            info = out('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path))
            self.lengths[key] = float(info)

    def length(self, key):
        return self.lengths.get(key, 0.0)


class Recorder:
    def __init__(self, raw_path):
        self.raw = raw_path
        self.proc = None
        self.t0 = None
        self.captions = []
        self.voice = None
        self.voice_events = []
        self.voice_end = 0.0

    def start(self):
        sw, sh = screen_size()
        self.proc = subprocess.Popen(
            ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '1',
             '-framerate', '30', '-video_size', f'{sw}x{sh}', '-i', os.environ.get('DISPLAY', ':0'),
             '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p', str(self.raw)],
            stdin=subprocess.PIPE)
        time.sleep(1.0)
        self.t0 = time.monotonic()

    def caption(self, text, seconds, say=None):
        """Show a caption; with `say`, also speak that narration line.

        Waits for the previous line to finish first, so voices never overlap,
        and keeps the caption up for at least as long as its line.
        """
        self.settle()
        start = time.monotonic() - self.t0
        length = self.voice.length(say) if self.voice and say else 0
        if length:
            self.voice_events.append((start, say))
            self.voice_end = start + length
        self.captions.append((start, start + max(seconds, length + 0.3), text))

    def settle(self, pad=0.35):
        """Hold the current scene until its narration line has finished."""
        if self.voice_end:
            wait = self.voice_end + pad - (time.monotonic() - self.t0)
            if wait > 0:
                time.sleep(wait)

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.communicate(b'q', timeout=30)


def make_video(session, out_mp4, voice=None):
    cap = Capturer(session)
    workdir = Path(tempfile.mkdtemp(prefix='clipflow-video-'))
    raw = workdir / 'raw.mp4'
    entries_json = workdir / 'entries.json'
    entries_json.write_text(json.dumps([e[0] for e in DEMO_ENTRIES], ensure_ascii=False))

    # Find the panel icon before recording so the blur mask can keep it visible.
    cap.open_recent_menu()
    cap.close_menu()
    time.sleep(0.8)

    rec = Recorder(raw)
    rec.voice = voice
    rec.start()
    try:
        rec.caption(f'ClipFlow Pro {version()} — clipboard history for GNOME Shell 45–51', 4, 'title')
        time.sleep(4)

        interval = 2200
        rec.caption('Copy anything: text, links, code, numbers, symbols, any language, emoji', len(DEMO_ENTRIES) * interval / 1000 + 2, 'copy')
        session.spawn('gjs', '-m', str(MEDIA_DIR / 'demo_source_window.js'), str(entries_json), str(interval), '1200')
        src = find_window('Demo — text to copy', timeout=10)
        place_window(src, 720, 820)
        time.sleep(len(DEMO_ENTRIES) * interval / 1000 + 2.5)
        rec.settle()
        run('wmctrl', '-i', '-c', src, check=False)
        window_closed(src)
        time.sleep(0.8)

        rec.caption('Right-click the panel icon: recent clips', 4, 'recent')
        cap.open_recent_menu()
        time.sleep(3.5)
        rec.settle()
        cap.close_menu()
        time.sleep(0.6)

        rec.caption('Panel menu: pinned, starred and recent clips', 4, 'panel')
        menu = cap.open_panel_menu()
        time.sleep(3)
        rec.settle()
        if menu:
            box = cap.menu_box(menu)
            rec.caption('⋮ on any clip: pin, star, copy cleaned, insert, delete', 4, 'row')
            cap.open_row_menu(box)
            time.sleep(3.5)
            rec.settle()
            key('Escape')
            time.sleep(0.6)
            if not cap.menu_open(box):
                menu = cap.open_panel_menu()
                box = cap.menu_box(menu) if menu else None
                time.sleep(0.8)
            if box:
                rec.caption('Actions: filter, sort, export / import, purge duplicates, pin top', 5, 'actions')
                grown = cap.expand_actions(box)
                time.sleep(1)
                # Glide down the actions so each one is seen.
                for y in range(grown[1] + 300, box[3] - 10, 30):
                    run('xdotool', 'mousemove', str(box[0] + 120), str(y), check=False)
                    time.sleep(0.15)
                time.sleep(2.5)
                rec.settle()
        cap.close_menu()
        time.sleep(0.6)

        rec.caption('Full history window — left-click the panel icon', 3.5, 'history')
        wid = cap.open_history_window()
        time.sleep(2.5)
        pts = cap.history_points(wid)
        rec.caption('Instant search in any language', 9, 'search')
        run('xdotool', 'mousemove', *map(str, pts['search']), 'click', '1', check=False)
        for query in ('hola', 'git', 'invoice'):
            type_text(query, 140)
            time.sleep(1.8)
            key('ctrl+a')
            key('BackSpace')
            time.sleep(0.6)
        rec.caption('Copy · Insert · Pin · Star · Delete', 4, 'row_actions')
        run('xdotool', 'mousemove', *map(str, pts['row2']), check=False)
        time.sleep(0.6)
        run('xdotool', 'click', '3', check=False)
        time.sleep(3)
        rec.settle()
        key('Escape')
        time.sleep(0.5)
        run('wmctrl', '-i', '-c', wid, check=False)
        window_closed(wid)

        for tab in PREFS_TABS:
            rec.caption(f'Settings — {tab.capitalize()}', 3.2, tab)
            pw = cap.open_prefs(tab)
            time.sleep(2.0)
            scroll_to_bottom(pw)
            time.sleep(1.0)
            rec.settle()
            run('wmctrl', '-i', '-c', pw, check=False)
            window_closed(pw)

        rec.caption('Free & open source · github.com/nickotmazgin/clipflow-pro', 4, 'end')
        time.sleep(4)
        rec.settle(pad=1.5)
    finally:
        rec.stop()

    render_video(raw, out_mp4, rec.captions, cap, workdir)
    add_audio(out_mp4, rec, workdir)
    shutil.rmtree(workdir, ignore_errors=True)


def render_video(raw, out_mp4, captions, cap, workdir):
    sw, sh = screen_size()
    py0, py1 = cap.panel_band
    ph = py1 - py0
    chains = ['[0:v]split=3[base][p][k]',
              f'[p]crop={sw}:{ph}:0:{py0},boxblur=luma_radius=20:luma_power=4:chroma_radius=10:chroma_power=4[pb]',
              '[base][pb]overlay=0:%d[t0]' % py0]
    last = 't0'
    if cap.icon:
        cx = (cap.icon[0] + cap.icon[1]) // 2
        kx = max(0, min(sw - 160, cx - 80))
        chains.append(f'[k]crop=160:{ph}:{kx}:{py0}[kc]')
        chains.append(f'[t0][kc]overlay={kx}:{py0}[t1]')
        last = 't1'
    else:
        chains.append('[k]nullsink')
    for i, (start, end, text) in enumerate(captions):
        tf = workdir / f'cap{i}.txt'
        tf.write_text(text, encoding='utf-8')
        nxt = f'c{i}'
        chains.append(
            f"[{last}]drawtext=fontfile={FONT}:textfile={tf}:fontsize=40:fontcolor=white:"
            f"box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=48:"
            f"enable='between(t,{start:.2f},{end:.2f})'[{nxt}]")
        last = nxt
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-filter_complex', ';'.join(chains),
        '-map', f'[{last}]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', '-r', '30', str(out_mp4))
    log(f'saved {out_mp4}')


MUSIC_GAIN = 0.045  # music bed well under the voice (about -27 dB)


def add_audio(mp4, rec, workdir):
    """Keep the silent picture and voice timings next to the video, then mix."""
    silent = mp4.with_name(mp4.stem + '.video-only.mp4')
    shutil.copy2(mp4, silent)
    events = [(start, str(rec.voice.files[k])) for start, k in rec.voice_events] if rec.voice else []
    mp4.with_name(mp4.stem + '.voice.json').write_text(json.dumps(events))
    mix_audio(silent, events, mp4, workdir)


def mix_audio(silent, events, mp4, workdir):
    """Narration over the original music bed, ducked under speech, at -14 LUFS."""
    length = float(out('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(silent)))
    music = Path(workdir) / 'music.wav'
    run(sys.executable, str(MEDIA_DIR / 'make_music.py'), str(music), f'{length:.2f}')
    inputs = ['-i', str(silent), '-i', str(music)]
    chains = [f'[1:a]volume={MUSIC_GAIN}[bed]']
    voices = []
    for i, (start, wav) in enumerate(events):
        inputs += ['-i', wav]
        ms = int(start * 1000)
        chains.append(f'[{i + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{i}]')
        voices.append(f'[v{i}]')
    if voices:
        chains.append(f"{''.join(voices)}amix=inputs={len(voices)}:normalize=0,asplit=2[vo][sc]")
        chains.append('[bed][sc]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=450[duck]')
        chains.append('[duck][vo]amix=inputs=2:normalize=0[mix]')
    else:
        chains.append('[bed]volume=3[mix]')
    chains.append('[mix]anull[a]')
    mixed = Path(workdir) / 'mix.wav'
    run('ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(chains),
        '-map', '[a]', '-t', f'{length:.2f}', str(mixed))
    # Two-pass loudness normalisation to -14 LUFS (YouTube / LinkedIn), -1.5 dBTP.
    target = 'I=-14:TP=-1.5:LRA=11'
    probe = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(mixed), '-af',
                            f'loudnorm={target}:print_format=json', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    m = json.loads(probe[probe.rindex('{'):probe.rindex('}') + 1])
    norm = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
            f"offset={m['target_offset']}:linear=true,aresample=48000")
    tmp = mp4.with_name(mp4.stem + '.tmp.mp4')
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', str(silent), '-i', str(mixed), '-af', norm,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', '-movflags', '+faststart', str(tmp))
    tmp.replace(mp4)
    log(f'mixed narration ({len(voices)} lines) and music into {mp4.name}')


def remix(mp4):
    """Re-mix the audio of an existing video without recording it again."""
    silent = mp4.with_name(mp4.stem + '.video-only.mp4')
    events = json.loads(mp4.with_name(mp4.stem + '.voice.json').read_text())
    with tempfile.TemporaryDirectory() as work:
        mix_audio(silent, events, mp4, work)


# ---------------------------------------------------------------- main

def preflight():
    if os.environ.get('XDG_SESSION_TYPE') != 'x11':
        sys.exit('This tool needs an X11 session (xdotool/x11grab).')
    for tool in ('xdotool', 'wmctrl', 'xclip', 'xprop', 'xwininfo', 'gjs', 'dconf', 'gnome-extensions'):
        if not shutil.which(tool):
            sys.exit(f'Missing tool: {tool}')
    info = out('gnome-extensions', 'info', UUID)
    if 'ACTIVE' not in info and 'ENABLED' not in info:
        sys.exit('ClipFlow Pro is not enabled. Install it (./install.sh) and reload GNOME Shell first.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['screenshots', 'video', 'all', 'restore', 'remix'])
    ap.add_argument('--out', type=Path, help='screenshot folder (default screenshots/v<version>)')
    ap.add_argument('--video-out', type=Path, help='video path (default dist/media/clipflow-pro-v<version>-demo.mp4)')
    ap.add_argument('--no-collage', action='store_true')
    ap.add_argument('--countdown', type=int, default=5)
    args = ap.parse_args()

    if args.command == 'restore':
        Session.restore_from(BACKUP_ROOT / 'latest')
        return
    if args.command == 'remix':
        remix(args.video_out or REPO / 'dist' / 'media' / f'clipflow-pro-v{version()}-demo.mp4')
        return

    preflight()
    if args.command in ('video', 'all') and not shutil.which('ffmpeg'):
        sys.exit('Missing tool: ffmpeg')
    shots_dir = args.out or REPO / 'screenshots' / f'v{version()}'
    video_out = args.video_out or REPO / 'dist' / 'media' / f'clipflow-pro-v{version()}-demo.mp4'

    voice = None
    if args.command in ('video', 'all'):
        # Speak the narration first (slow on CPU), before touching the desktop.
        if Voice.available():
            voice = Voice()
            voice.prepare()
        else:
            log('Kokoro is not installed; the video will have music but no narration (see tools/media/README.md)')

    for n in range(args.countdown, 0, -1):
        print(f'Starting in {n}… hands off the mouse and keyboard (Ctrl+C to abort)', flush=True)
        time.sleep(1)

    session = Session()
    session.backup()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        if args.command in ('screenshots', 'all'):
            session.enter_demo(seed=True)
            take_screenshots(session, shots_dir, collage=not args.no_collage)
            session.cleanup_windows()
        if args.command in ('video', 'all'):
            session.enter_demo(seed=False)
            make_video(session, video_out, voice)
            session.cleanup_windows()
    finally:
        session.cleanup_windows()
        Session.restore_from(session.dir)


if __name__ == '__main__':
    main()
