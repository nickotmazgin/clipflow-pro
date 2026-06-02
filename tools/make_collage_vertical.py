#!/usr/bin/env python3
"""Vertical numbered collage (1→2→3) for ClipFlow Pro screenshots."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Reuse visual language from make_collage_2026.py
GRAD_LEFT = (255, 120, 40)
GRAD_MID = (40, 180, 90)
GRAD_RIGHT = (120, 60, 200)

TITLE_H = 140
TITLE_GAP = 48
PAD = 40
BOTTOM_PAD = 56
TILE_GAP = 36
TILE_PAD = 14
TILE_BG = (16, 18, 28)
RADIUS = 12
CONTENT_W = 1400

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


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


def sharpen(img: Image.Image) -> Image.Image:
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=1))


def fit_width(img: Image.Image, max_w: int) -> Image.Image:
    w, h = img.size
    if w <= max_w:
        return sharpen(img.copy())
    scale = max_w / w
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    return sharpen(img.resize((nw, nh), Image.Resampling.LANCZOS))


def tile(img: Image.Image) -> Image.Image:
    fitted = fit_width(img.convert("RGBA"), CONTENT_W)
    cw, ch = fitted.width + TILE_PAD * 2, fitted.height + TILE_PAD * 2
    canvas = Image.new("RGBA", (cw, ch), TILE_BG + (255,))
    canvas.paste(fitted, (TILE_PAD, TILE_PAD), fitted)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((1, 1, cw - 2, ch - 2), radius=RADIUS, outline=(255, 255, 255, 40), width=1)
    return canvas


def rounded(im: Image.Image, radius: int = RADIUS) -> Image.Image:
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


def drop_shadow(im: Image.Image) -> Image.Image:
    blur, offset = 14, (0, 6)
    w, h = im.size
    pad = blur * 2 + abs(offset[0]) + abs(offset[1])
    layer = Image.new("RGBA", (w + pad, h + pad), (0, 0, 0, 0))
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 90))
    shadow.putalpha(im.split()[3])
    sx, sy = blur + max(offset[0], 0), blur + max(offset[1], 0)
    layer.paste(shadow, (sx + offset[0], sy + offset[1]))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def paste_layer(base: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    base.paste(layer, xy, layer)


def draw_badge(tile: Image.Image, number: int) -> Image.Image:
    out = tile.copy()
    draw = ImageDraw.Draw(out)
    badge_r = 28
    cx, cy = 24 + badge_r, 24 + badge_r
    draw.ellipse((cx - badge_r, cy - badge_r, cx + badge_r, cy + badge_r),
                 fill=(255, 120, 40, 240), outline=(255, 255, 255, 200), width=2)
    draw.text((cx, cy), str(number), fill=(255, 255, 255), font=font(32), anchor="mm",
              stroke_width=1, stroke_fill=(0, 0, 0, 160))
    return out


def draw_title(canvas: Image.Image, title: str, subtitle: str) -> None:
    draw = ImageDraw.Draw(canvas)
    tw = canvas.width
    overlay = Image.new("RGBA", (tw, TITLE_H), (0, 0, 0, 120))
    canvas.paste(overlay, (0, 0), overlay)
    draw.text((tw // 2, 42), title, fill=(255, 255, 255), font=font(56), anchor="mm",
              stroke_width=2, stroke_fill=(0, 0, 0, 180))
    draw.text((tw // 2, 98), subtitle, fill=(245, 245, 250), font=font(26), anchor="mm",
              stroke_width=1, stroke_fill=(0, 0, 0, 140))


def build_vertical(paths: list[Path], title: str, subtitle: str) -> Image.Image:
    tiles = []
    for i, path in enumerate(paths, start=1):
        im = Image.open(path).convert("RGBA")
        tiles.append(draw_badge(tile(im), i))

    col_w = max(t.width for t in tiles)
    col_h = sum(t.height for t in tiles) + TILE_GAP * (len(tiles) - 1)
    total_w = col_w + PAD * 2
    total_h = TITLE_H + TITLE_GAP + col_h + PAD + BOTTOM_PAD

    canvas = horizontal_gradient(total_w, total_h)
    draw_title(canvas, title, subtitle)

    y = TITLE_H + TITLE_GAP + PAD // 2
    for t in tiles:
        x = PAD + (col_w - t.width) // 2
        rt = rounded(t)
        sh = drop_shadow(rt)
        paste_layer(canvas, sh, (x - (sh.width - rt.width) // 2, y - (sh.height - rt.height) // 2))
        paste_layer(canvas, rt, (x, y))
        y += t.height + TILE_GAP

    return canvas


SOCIAL_SIZES = {
    "1920x1080": (1920, 1080),
    "1080x1080": (1080, 1080),
    "1280x640": (1280, 640),
}


def export_social(collage: Image.Image, tw: int, th: int) -> Image.Image:
    margin = 48
    canvas = horizontal_gradient(tw, th)
    scale = min((tw - margin * 2) / collage.width, (th - margin * 2) / collage.height)
    nw, nh = round(collage.width * scale), round(collage.height * scale)
    fitted = sharpen(collage.resize((nw, nh), Image.Resampling.LANCZOS)).convert("RGBA")
    mask = Image.new("L", (nw, nh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, nw, nh), radius=RADIUS + 4, fill=255)
    fitted.putalpha(mask)
    x, y = (tw - nw) // 2, (th - nh) // 2
    sh = drop_shadow(fitted)
    paste_layer(canvas, sh, (x - (sh.width - nw) // 2, y - (sh.height - nh) // 2))
    paste_layer(canvas, fitted, (x, y))
    return canvas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("image1")
    p.add_argument("image2")
    p.add_argument("image3")
    p.add_argument("-o", "--output", required=True, help="Main collage PNG path")
    p.add_argument("--social-dir", help="Export social sizes here")
    p.add_argument("--title", default="ClipFlow Pro v1.4.1")
    p.add_argument("--subtitle",
                   default="History Window · Panel Menu · Settings Shortcuts · 2026")
    args = p.parse_args()

    paths = [Path(args.image1), Path(args.image2), Path(args.image3)]
    for path in paths:
        if not path.is_file():
            raise SystemExit(f"Missing image: {path}")

    collage = build_vertical(paths, args.title, args.subtitle)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    collage.save(out, "PNG", compress_level=1, optimize=False)
    print(f"Wrote {out} ({collage.width}x{collage.height})")

    if args.social_dir:
        social = Path(args.social_dir)
        social.mkdir(parents=True, exist_ok=True)
        slug = "clipflow-pro"
        hd = social / f"{slug}-v141-collage-hd.png"
        collage.save(hd, "PNG", compress_level=1, optimize=False)
        print(f"  HD: {hd}")
        for label, (tw, th) in SOCIAL_SIZES.items():
            path = social / f"{slug}-v141-social-{label}.png"
            export_social(collage, tw, th).save(path, "PNG", compress_level=1, optimize=False)
            print(f"  social {label}: {path}")


if __name__ == "__main__":
    main()
