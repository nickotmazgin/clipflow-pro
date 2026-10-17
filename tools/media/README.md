# Screenshots and demo video

`clipflow_media.py` captures the gallery screenshots and records an HD demo
video of ClipFlow Pro on a real GNOME session (X11).

```bash
python3 tools/media/clipflow_media.py screenshots   # screenshots/v<version>/ + collage
python3 tools/media/clipflow_media.py video         # dist/media/clipflow-pro-v<version>-demo.mp4
python3 tools/media/clipflow_media.py all           # both
python3 tools/media/clipflow_media.py remix         # re-mix voice + music of the last video (no recording)
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

## Narration and music

The video gets a natural English voice-over and an upbeat music bed, mixed to
-14 LUFS for YouTube and LinkedIn. Both are free to use anywhere:

- **Voice:** [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0 model and voices) via
  [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT), run locally. Edit the lines,
  voice (`af_heart` by default; try `bm_george`) and speed in [`narration.py`](narration.py).
  Each scene waits for its line to finish; spoken lines are cached.
- **Music:** [`make_music.py`](make_music.py) synthesises an original track from scratch (no samples,
  no third-party audio), so there is nothing to license or credit. It ducks under the voice.

One-time setup (about 350 MB, kept in `~/.cache/clipflow-pro-media-tools`):

```bash
D=~/.cache/clipflow-pro-media-tools; mkdir -p "$D" && cd "$D"
python3 -m venv venv && ./venv/bin/pip install kokoro-onnx soundfile
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Without it, the video is still made, with music but no narration.

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
