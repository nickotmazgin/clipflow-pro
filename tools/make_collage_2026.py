#!/usr/bin/env python3
"""Lossless PNG collages + HD social exports for GitHub and social networks."""
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

SOCIAL_SIZES = {
    "1920x1080": (1920, 1080),   # X / Twitter, Facebook, LinkedIn landscape
    "1080x1080": (1080, 1080),   # Instagram square
    "1280x640": (1280, 640),     # GitHub OG / link previews
}

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
]

PRODUCT = {
    "clipflow": {
        "slug": "clipflow-pro",
        "title": "ClipFlow Pro",
        "subtitle": "GNOME Clipboard History · History Window · Panel Menu · 2026",
    },
    "numeric": {
        "slug": "numeric-clock",
        "title": "Numeric Clock",
        "subtitle": "DD/MM/YYYY 24-Hour Top Bar Clock · Settings · About · 2026",
    },
    "easehub": {
        "slug": "comfort-control-easehub",
        "title": "Comfort Control (EaseHub)",
        "subtitle": "Panel Menu · Power · Screenshots · Updates · Preferences · 2026",
    },
}


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


def sharpen(img: Image.Image) -> Image.Image:
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=1))


def fit_sharp(img: Image.Image, max_w: int, max_h: int, allow_upscale: bool = False) -> Image.Image:
    w, h = img.size
    scale = min(max_w / w, max_h / h)
    if not allow_upscale:
        scale = min(scale, 1.0)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if nw == w and nh == h:
        return img.copy()
    return sharpen(img.resize((nw, nh), Image.Resampling.LANCZOS))


def tile(img: Image.Image, cw: int, ch: int, allow_upscale: bool = False) -> Image.Image:
    inner_w, inner_h = cw - TILE_PAD * 2, ch - TILE_PAD * 2
    fitted = fit_sharp(img, inner_w, inner_h, allow_upscale=allow_upscale)
    canvas = Image.new("RGBA", (cw, ch), TILE_BG + (255,))
    canvas.paste(fitted, ((cw - fitted.width) // 2, (ch - fitted.height) // 2), fitted)
    # subtle border for tile definition
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((1, 1, cw - 2, ch - 2), radius=RADIUS, outline=(255, 255, 255, 40), width=1)
    return canvas


def tile_native(img: Image.Image, allow_upscale: bool = False) -> Image.Image:
    w, h = img.size
    return tile(img, w + TILE_PAD * 2, h + TILE_PAD * 2, allow_upscale=allow_upscale)


def rounded(im: Image.Image, radius: int = RADIUS) -> Image.Image:
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


def drop_shadow(im: Image.Image, offset: tuple[int, int] = (0, 6), blur: int = 14) -> Image.Image:
    """RGBA layer: soft shadow sized for im, ready to paste under im at same origin."""
    w, h = im.size
    pad = blur * 2 + abs(offset[0]) + abs(offset[1])
    layer = Image.new("RGBA", (w + pad, h + pad), (0, 0, 0, 0))
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 90))
    shadow.putalpha(im.split()[3] if im.mode == "RGBA" else Image.new("L", im.size, 255))
    sx, sy = blur + max(offset[0], 0), blur + max(offset[1], 0)
    layer.paste(shadow, (sx + offset[0], sy + offset[1]))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def paste_layer(base: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    base.paste(layer, xy, layer if layer.mode == "RGBA" else None)


def draw_title(canvas: Image.Image, title: str, subtitle: str) -> None:
    draw = ImageDraw.Draw(canvas)
    tw = canvas.width
    overlay = Image.new("RGBA", (tw, TITLE_H), (0, 0, 0, 120))
    canvas.paste(overlay, (0, 0), overlay)
    draw.text((tw // 2, 42), title, fill=(255, 255, 255), font=font(56), anchor="mm",
              stroke_width=2, stroke_fill=(0, 0, 0, 180))
    draw.text((tw // 2, 98), subtitle, fill=(245, 245, 250), font=font(28), anchor="mm",
              stroke_width=1, stroke_fill=(0, 0, 0, 140))


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
            ty = y0 + (rh - t.height) // 2
            sh = drop_shadow(rt)
            paste_layer(canvas, sh, (x - (sh.width - rt.width) // 2, ty - (sh.height - rt.height) // 2))
            paste_layer(canvas, rt, (x, ty))
            x += t.width + TILE_GAP
        y0 += rh + TILE_GAP
    return canvas


def build_clipflow(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    tiles = [tile_native(im) for im in imgs]
    meta = PRODUCT["clipflow"]
    n = len(tiles)
    if n <= 5:
        rows = [tiles]
    elif n == 7:
        rows = [tiles[0:4], tiles[4:7]]
    else:
        rows = [tiles[0:5], tiles[5:10]]
    return compose_grid(rows, meta["title"], meta["subtitle"])


def build_numeric(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    banner = tile(imgs[0], 2000, 120, allow_upscale=True)
    meta = PRODUCT["numeric"]
    return compose_grid([[banner], [tile_native(imgs[1]), tile_native(imgs[2])]],
                        meta["title"], meta["subtitle"])


def build_easehub(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    top = [tile_native(imgs[0]), tile_native(imgs[1])]
    bottom = [tile_native(imgs[2]), tile_native(imgs[3]), tile_native(imgs[4])]
    meta = PRODUCT["easehub"]
    return compose_grid([top, bottom], meta["title"], meta["subtitle"])


BUILDERS = {"clipflow": build_clipflow, "numeric": build_numeric, "easehub": build_easehub}


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, "PNG", compress_level=1, optimize=False)


def export_social(collage: Image.Image, tw: int, th: int) -> Image.Image:
    """Fit collage inside canvas with gradient letterbox, rounded corners, and shadow."""
    margin = 48
    canvas = horizontal_gradient(tw, th)
    scale = min((tw - margin * 2) / collage.width, (th - margin * 2) / collage.height)
    nw, nh = round(collage.width * scale), round(collage.height * scale)
    fitted = rounded(sharpen(collage.resize((nw, nh), Image.Resampling.LANCZOS)).convert("RGBA"), RADIUS + 4)
    x, y = (tw - nw) // 2, (th - nh) // 2
    sh = drop_shadow(fitted, offset=(0, 8), blur=16)
    paste_layer(canvas, sh, (x - (sh.width - nw) // 2, y - (sh.height - nh) // 2))
    paste_layer(canvas, fitted, (x, y))
    return canvas


def export_all_socials(collage: Image.Image, out_dir: Path, slug: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    hd = out_dir / f"{slug}-collage-hd.png"
    save_png(collage, hd)
    for label, (tw, th) in SOCIAL_SIZES.items():
        path = out_dir / f"{slug}-social-{label}.png"
        save_png(export_social(collage, tw, th), path)
        print(f"  social {label}: {path.name} ({tw}x{th})")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("kind", choices=BUILDERS)
    p.add_argument("src_dir")
    p.add_argument("out_file", help="Repo collage path (screenshots/collage-2026.png)")
    p.add_argument("--social-dir", dest="social_dir", help="Export HD + all social sizes to this folder")
    p.add_argument("--github-social", dest="github_social", help="Copy 1280x640 to this path")
    args = p.parse_args()

    kind = args.kind
    slug = PRODUCT[kind]["slug"]
    collage = BUILDERS[kind](Path(args.src_dir))
    out = Path(args.out_file)
    save_png(collage, out)
    print(f"Wrote {out} ({collage.width}x{collage.height})")

    if args.social_dir:
        export_all_socials(collage, Path(args.social_dir), slug)

    if args.github_social:
        save_png(export_social(collage, 1280, 640), Path(args.github_social))
        print(f"Wrote {args.github_social}")


if __name__ == "__main__":
    main()
