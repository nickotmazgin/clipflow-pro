# Screenshots and demo video

`clipflow_media.py` captures the gallery screenshots and records an HD demo
video of ClipFlow Pro on a real GNOME session (X11).

```bash
python3 tools/media/clipflow_media.py screenshots   # screenshots/v<version>/ + collage
python3 tools/media/clipflow_media.py video         # dist/media/clipflow-pro-v<version>-demo.mp4
python3 tools/media/clipflow_media.py all           # both
python3 tools/media/clipflow_media.py restore       # put your state back by hand if a run was killed
```

Requirements: GNOME Shell on X11, ClipFlow Pro installed and enabled, and
`xdotool wmctrl xclip x11-utils imagemagick ffmpeg python3-pil python3-numpy gjs`.

Hands off the mouse and keyboard while it runs (about 1 minute for screenshots,
3 minutes for the video).

## What it captures

| File | Shows |
|---|---|
| 01–03 | History window, search, row actions |
| 04 | Recent clips (right-click on the panel icon) |
| 05–07 | Panel menu, the ⋮ clip menu, Actions expanded |
| 08–12 | Every settings tab |

The video copies the demo entries one by one (text, a link, code, JSON, a
currency line, several languages including right-to-left, symbols and emoji),
then walks through the menus, the history window and every settings tab,
scrolling each tab to the bottom. Captions are added with ffmpeg.

Edit the demo entries in [`demo_entries.py`](demo_entries.py).

The GitHub social preview (1280×640) is built from the screenshots:

```bash
python3 tools/media/make_social_preview.py screenshots/v<version> screenshots/social-preview-v<version>.png <version>
```

Upload it under **Settings → General → Social preview**.

## Privacy and safety

- Your history, ClipFlow settings and clipboard are backed up to
  `~/.cache/clipflow-pro-media/` (private, 0700) and restored at the end, even
  on Ctrl+C. If a run is killed, the next run restores the old backup first.
- Notification banners and desktop icons are turned off, CopyQ monitoring is
  paused, and all other app windows are minimised for the run and brought back
  afterwards. Keys are never sent while another app has focus.
- Screenshots are cropped to ClipFlow windows and menus. Panel-menu shots are
  only taken when the menu is anchored on the ClipFlow icon, never another tray
  menu (those can show Wi-Fi names and similar).
- In the video, the taskbar is blurred except around the ClipFlow icon.
- Review the output before publishing it anyway.
