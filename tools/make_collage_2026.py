#!/usr/bin/env python3
"""Build collage-2026.png from numbered PNGs in a source folder."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Allow running from repo root: python3 tools/make_collage_2026.py clipflow "/path/to/shots" screenshots/collage-2026.png

def natural_sort_key(path: Path) -> tuple:
    m = re.match(r"^(\d+)", path.stem)
    return (int(m.group(1)) if m else 9999, path.name)


def load_numbered_images(src_dir: Path) -> list[Image.Image]:
    files = sorted(src_dir.glob("*.png"), key=natural_sort_key)
    if not files:
        raise SystemExit(f"No PNG files in {src_dir}")
    return [Image.open(f).convert("RGBA") for f in files]


def fit_image(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    scale = min(max_w / w, max_h / h, 1.0)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def cell(img: Image.Image, cw: int, ch: int, bg: tuple[int, int, int]) -> Image.Image:
    fitted = fit_image(img, cw - 24, ch - 24)
    canvas = Image.new("RGBA", (cw, ch), bg + (255,))
    ox = (cw - fitted.width) // 2
    oy = (ch - fitted.height) // 2
    canvas.paste(fitted, (ox, oy), fitted)
    return canvas


def rounded(img: Image.Image, radius: int = 10) -> Image.Image:
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def gradient_bg(w: int, h: int, c1: tuple, c2: tuple, c3: tuple | None = None) -> Image.Image:
    base = Image.new("RGB", (w, h))
    px = base.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        if c3 is None:
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
        else:
            if t < 0.5:
                u = t * 2
                r = int(c1[0] + (c2[0] - c1[0]) * u)
                g = int(c1[1] + (c2[1] - c1[1]) * u)
                b = int(c1[2] + (c2[2] - c1[2]) * u)
            else:
                u = (t - 0.5) * 2
                r = int(c2[0] + (c3[0] - c2[0]) * u)
                g = int(c2[1] + (c3[1] - c2[1]) * u)
                b = int(c2[2] + (c3[2] - c2[2]) * u)
        for x in range(w):
            px[x, y] = (r, g, b)
    return base


def compose(rows: list[list[Image.Image]], gap: int, bg_colors: tuple) -> Image.Image:
    if len(bg_colors) == 2:
        c1, c2 = bg_colors
        c3 = None
    else:
        c1, c2, c3 = bg_colors

    row_widths = []
    row_heights = []
    for row in rows:
        row_widths.append(sum(im.width for im in row) + gap * (len(row) - 1))
        row_heights.append(max(im.height for im in row))
    total_w = max(row_widths)
    total_h = sum(row_heights) + gap * (len(rows) - 1)
    canvas = gradient_bg(total_w + gap * 2, total_h + gap * 2, c1, c2, c3).convert("RGBA")

    y = gap
    for row, rh in zip(rows, row_heights):
        x = gap + (total_w - (sum(im.width for im in row) + gap * (len(row) - 1))) // 2
        for im in row:
            tile = rounded(im)
            canvas.paste(tile, (x, y + (rh - tile.height) // 2), tile)
            x += im.width + gap
        y += rh + gap
    return canvas.convert("RGB")


def build_clipflow(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    bg = (18, 22, 38)
    tiles = [cell(im, 420, 500, bg) for im in imgs]
    return compose([tiles[0:5], tiles[5:10]], 14, ((14, 18, 32), (28, 36, 68)))


def build_numeric(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    bg = (20, 24, 36)
    banner = cell(imgs[0], 1280, 100, bg)
    left = cell(imgs[1], 620, 720, bg)
    right = cell(imgs[2], 620, 720, bg)
    return compose([[banner], [left, right]], 16, ((16, 20, 34), (32, 48, 88)))


def build_easehub(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    bg = (22, 26, 34)
    top = [cell(imgs[0], 640, 520, bg), cell(imgs[1], 640, 520, bg)]
    bottom = [cell(imgs[2], 420, 520, bg), cell(imgs[3], 420, 520, bg), cell(imgs[4], 420, 520, bg)]
    return compose([top, bottom], 14, ((18, 36, 72), (24, 88, 72), (255, 140, 64)))


BUILDERS = {"clipflow": build_clipflow, "numeric": build_numeric, "easehub": build_easehub}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("kind", choices=BUILDERS)
    p.add_argument("src_dir")
    p.add_argument("out_file")
    args = p.parse_args()
    out = Path(args.out_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    collage = BUILDERS[args.kind](Path(args.src_dir))
    collage.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({collage.width}x{collage.height})")


if __name__ == "__main__":
    main()
