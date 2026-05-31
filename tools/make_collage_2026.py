#!/usr/bin/env python3
"""Lossless PNG collages — native-res tiles, no JPEG (UI text stays sharp)."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

GRAD_LEFT = (255, 120, 40)
GRAD_MID = (40, 180, 90)
GRAD_RIGHT = (120, 60, 200)

TITLE_H = 140
TITLE_GAP = 40
PAD = 32
TILE_GAP = 24
TILE_PAD = 12
TILE_BG = (16, 18, 28)
RADIUS = 12

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def natural_sort_key(path: Path) -> tuple:
    m = re.match(r"^(\d+)", path.stem)
    return (int(m.group(1)) if m else 9999, path.name)


def load_numbered_images(src_dir: Path) -> list[Image.Image]:
    files = sorted(src_dir.glob("*.png"), key=natural_sort_key)
    if not files:
        raise SystemExit(f"No PNG files in {src_dir}")
    return [Image.open(f).convert("RGBA") for f in files]


def horizontal_gradient(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    for x in range(w):
        t = x / max(w - 1, 1)
        if t < 0.5:
            u = t * 2
            r = int(GRAD_LEFT[0] + (GRAD_MID[0] - GRAD_LEFT[0]) * u)
            g = int(GRAD_LEFT[1] + (GRAD_MID[1] - GRAD_LEFT[1]) * u)
            b = int(GRAD_LEFT[2] + (GRAD_MID[2] - GRAD_LEFT[2]) * u)
        else:
            u = (t - 0.5) * 2
            r = int(GRAD_MID[0] + (GRAD_RIGHT[0] - GRAD_MID[0]) * u)
            g = int(GRAD_MID[1] + (GRAD_RIGHT[1] - GRAD_MID[1]) * u)
            b = int(GRAD_MID[2] + (GRAD_RIGHT[2] - GRAD_MID[2]) * u)
        for y in range(h):
            px[x, y] = (r, g, b)
    return img


def fit_sharp(img: Image.Image, max_w: int, max_h: int, allow_upscale: bool = False) -> Image.Image:
    w, h = img.size
    scale = min(max_w / w, max_h / h)
    if not allow_upscale:
        scale = min(scale, 1.0)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if nw == w and nh == h:
        return img.copy()
    out = img.resize((nw, nh), Image.Resampling.LANCZOS)
    return out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))


def tile(img: Image.Image, cw: int, ch: int, allow_upscale: bool = False) -> Image.Image:
    inner_w, inner_h = cw - TILE_PAD * 2, ch - TILE_PAD * 2
    fitted = fit_sharp(img, inner_w, inner_h, allow_upscale=allow_upscale)
    canvas = Image.new("RGBA", (cw, ch), TILE_BG + (255,))
    canvas.paste(fitted, ((cw - fitted.width) // 2, (ch - fitted.height) // 2), fitted)
    return canvas


def tile_native(img: Image.Image, allow_upscale: bool = False) -> Image.Image:
    """Tile sized to image — never downscale below native unless wider than max."""
    w, h = img.size
    cw, ch = w + TILE_PAD * 2, h + TILE_PAD * 2
    return tile(img, cw, ch, allow_upscale=allow_upscale)


def rounded(im: Image.Image, radius: int = RADIUS) -> Image.Image:
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


def draw_title(canvas: Image.Image, title: str, subtitle: str) -> None:
    draw = ImageDraw.Draw(canvas)
    tw = canvas.width
    overlay = Image.new("RGBA", (tw, TITLE_H), (0, 0, 0, 110))
    canvas.paste(overlay, (0, 0), overlay)
    draw.text((tw // 2, 42), title, fill=(255, 255, 255), font=font(56), anchor="mm")
    draw.text((tw // 2, 98), subtitle, fill=(240, 240, 248), font=font(28), anchor="mm")


def compose_grid(rows: list[list[Image.Image]], title: str, subtitle: str) -> Image.Image:
    row_widths = [sum(t.width for t in row) + TILE_GAP * (len(row) - 1) for row in rows]
    row_heights = [max(t.height for t in row) for row in rows]
    grid_w, grid_h = max(row_widths), sum(row_heights) + TILE_GAP * (len(rows) - 1)
    total_w, total_h = grid_w + PAD * 2, TITLE_H + TITLE_GAP + grid_h + PAD
    canvas = horizontal_gradient(total_w, total_h)
    draw_title(canvas, title, subtitle)
    y0 = TITLE_H + TITLE_GAP + PAD // 2
    for row, rh in zip(rows, row_heights):
        row_w = sum(t.width for t in row) + TILE_GAP * (len(row) - 1)
        x = PAD + (grid_w - row_w) // 2
        for t in row:
            rt = rounded(t.convert("RGBA"))
            canvas.paste(rt, (x, y0 + (rh - t.height) // 2), rt)
            x += t.width + TILE_GAP
        y0 += rh + TILE_GAP
    return canvas


def build_clipflow(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    # Native resolution tiles (~923×991) — 5×2 grid, no downscale
    tiles = [tile_native(im) for im in imgs]
    return compose_grid(
        [tiles[0:5], tiles[5:10]],
        "ClipFlow Pro",
        "GNOME Clipboard History · History Window · Panel Menu · 2026",
    )


def build_numeric(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    banner = tile(imgs[0], 2000, 120, allow_upscale=True)
    left = tile_native(imgs[1])
    right = tile_native(imgs[2])
    return compose_grid(
        [[banner], [left, right]],
        "Numeric Clock",
        "DD/MM/YYYY 24-Hour Top Bar Clock · Settings · About · 2026",
    )


def build_easehub(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    top = [tile_native(imgs[0]), tile_native(imgs[1])]
    bottom = [tile_native(imgs[2]), tile_native(imgs[3]), tile_native(imgs[4])]
    return compose_grid(
        [top, bottom],
        "Comfort Control (EaseHub)",
        "Panel Menu · Power · Screenshots · Updates · Preferences · 2026",
    )


BUILDERS = {"clipflow": build_clipflow, "numeric": build_numeric, "easehub": build_easehub}


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, "PNG", compress_level=3, optimize=False)


def social_from_collage(collage_path: Path, out_path: Path) -> None:
    src = Image.open(collage_path).convert("RGB")
    tw, th = 1280, 640
    canvas = horizontal_gradient(tw, th)
    scale = min((tw - 48) / src.width, (th - 48) / src.height)
    nw, nh = round(src.width * scale), round(src.height * scale)
    fitted = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((tw - nw) // 2, (th - nh) // 2))
    save_png(canvas, out_path)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("kind", choices=BUILDERS)
    p.add_argument("src_dir")
    p.add_argument("out_file")
    p.add_argument("--social", help="Optional social preview PNG path")
    args = p.parse_args()
    collage = BUILDERS[args.kind](Path(args.src_dir))
    out = Path(args.out_file)
    save_png(collage, out)
    print(f"Wrote {out} ({collage.width}x{collage.height}) PNG lossless")
    if args.social:
        social_from_collage(out, Path(args.social))
        print(f"Wrote {args.social}")


if __name__ == "__main__":
    main()
