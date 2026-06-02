#!/usr/bin/env python3
"""Stack the main collage on top and three screenshots in a horizontal row below."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

GRAD_LEFT = (255, 120, 40)
GRAD_MID = (40, 180, 90)
GRAD_RIGHT = (120, 60, 200)

PAD = 40
SECTION_GAP = 56
BOTTOM_PAD = 48
TILE_GAP = 32
TILE_PAD = 12
TILE_BG = (16, 18, 28)
RADIUS = 12
ROW_MAX_H = 920


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


def fit_in_box(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    scale = min(max_w / w, max_h / h, 1.0)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if nw == w and nh == h:
        return sharpen(img.copy())
    return sharpen(img.resize((nw, nh), Image.Resampling.LANCZOS))


def tile(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    fitted = fit_in_box(img.convert("RGBA"), max_w, max_h)
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


def build_stack(main_path: Path, row_paths: list[Path]) -> Image.Image:
    main = Image.open(main_path).convert("RGBA")

    inner_w = main.width - PAD * 2
    slot_w = max(1, (inner_w - TILE_GAP * (len(row_paths) - 1)) // len(row_paths))
    tiles = [tile(Image.open(p).convert("RGBA"), slot_w, ROW_MAX_H) for p in row_paths]

    row_w = sum(t.width for t in tiles) + TILE_GAP * (len(tiles) - 1)
    row_h = max(t.height for t in tiles)

    canvas_w = max(main.width, row_w + PAD * 2)
    canvas_h = main.height + SECTION_GAP + row_h + BOTTOM_PAD

    canvas = horizontal_gradient(canvas_w, canvas_h)

    mx = (canvas_w - main.width) // 2
    paste_layer(canvas, main, (mx, 0))

    y = main.height + SECTION_GAP
    x = PAD + (canvas_w - PAD * 2 - row_w) // 2
    for t in tiles:
        rt = rounded(t)
        ty = y + (row_h - t.height) // 2
        sh = drop_shadow(rt)
        paste_layer(canvas, sh, (x - (sh.width - rt.width) // 2, ty - (sh.height - rt.height) // 2))
        paste_layer(canvas, rt, (x, ty))
        x += t.width + TILE_GAP

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
    p.add_argument("--main", required=True, help="Top collage PNG (e.g. collage-2026.png)")
    p.add_argument("image1")
    p.add_argument("image2")
    p.add_argument("image3")
    p.add_argument("-o", "--output", required=True)
    p.add_argument("--social-dir")
    args = p.parse_args()

    main_path = Path(args.main)
    row_paths = [Path(args.image1), Path(args.image2), Path(args.image3)]
    for path in [main_path, *row_paths]:
        if not path.is_file():
            raise SystemExit(f"Missing: {path}")

    collage = build_stack(main_path, row_paths)
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
