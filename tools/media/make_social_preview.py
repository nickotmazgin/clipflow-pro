#!/usr/bin/env python3
"""GitHub social preview (1280x640) from the release screenshots.

Usage: python3 tools/media/make_social_preview.py screenshots/v<version> out.png <version>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from make_collage_2026 import (  # noqa: E402
    cloud_background, drop_shadow, font, paste_layer, rounded, save_png, sharpen,
)

W, H = 1280, 640


def place(canvas, img, width, xy, radius=14):
    scale = width / img.width
    im = img.resize((width, round(img.height * scale)), Image.Resampling.LANCZOS)
    im = rounded(sharpen(im).convert('RGBA'), radius)
    sh = drop_shadow(im, offset=(0, 10), blur=18)
    paste_layer(canvas, sh, (xy[0] - (sh.width - im.width) // 2, xy[1] - (sh.height - im.height) // 2))
    paste_layer(canvas, im, xy)
    return im.size


def main():
    src, out, version = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    canvas = cloud_background(W, H, seed=7).convert('RGBA')
    shade = Image.new('RGBA', (W, H), (10, 12, 22, 170))
    canvas = Image.alpha_composite(canvas, shade)

    history = Image.open(src / '01-history-window.png').convert('RGBA')
    row_menu = Image.open(src / '06-panel-row-menu.png').convert('RGBA')
    place(canvas, history, 640, (590, 150))
    place(canvas, row_menu, 250, (1000, 230))

    d = ImageDraw.Draw(canvas)
    d.text((56, 160), 'ClipFlow Pro', font=font(58), fill=(255, 255, 255))
    lines = ['Clipboard history', 'for GNOME Shell 45–51']
    for i, line in enumerate(lines):
        d.text((58, 240 + i * 42), line, font=font(32), fill=(220, 226, 240))
    points = ['Search in any language', 'Pin · Star · Insert', 'Private, local-only']
    for i, p in enumerate(points):
        d.text((58, 360 + i * 34), f'•  {p}', font=font(22), fill=(190, 200, 222))
    d.text((58, 545), f'v{version}  ·  Wayland & X11  ·  GPL-3.0', font=font(20), fill=(160, 172, 200))
    save_png(canvas.convert('RGB'), out)
    print(f'Wrote {out} ({W}x{H})')


if __name__ == '__main__':
    main()
