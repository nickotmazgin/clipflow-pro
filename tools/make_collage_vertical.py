#!/usr/bin/env python3
"""Stack the main collage on top; three screenshots below, horizontal, as-is (no tile frames)."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

GRAD_LEFT = (255, 120, 40)
GRAD_MID = (40, 180, 90)
GRAD_RIGHT = (120, 60, 200)

PAD = 40
SECTION_GAP = 44
BOTTOM_PAD = 44
IMAGE_GAP = 28
RADIUS = 8
ROW_MAX_H = 1000


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


def fit_in_box(img: Image.Image, max_w: int, max_h: int, *, allow_upscale: bool = True) -> Image.Image:
    w, h = img.size
    scale = min(max_w / w, max_h / h)
    if not allow_upscale:
        scale = min(scale, 1.0)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if nw == w and nh == h:
        return sharpen(img.copy())
    return sharpen(img.resize((nw, nh), Image.Resampling.LANCZOS))


def build_row_as_is(row_paths: list[Path], inner_w: int) -> tuple[list[Image.Image], int, int]:
    n = len(row_paths)
    slot_w = max(1, (inner_w - IMAGE_GAP * (n - 1)) // n)
    images = [
        fit_in_box(Image.open(p).convert("RGB"), slot_w, ROW_MAX_H, allow_upscale=True)
        for p in row_paths
    ]
    row_w = sum(im.width for im in images) + IMAGE_GAP * (n - 1)
    row_h = max(im.height for im in images)
    return images, row_w, row_h


def paste_layer(base: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    base.paste(layer, xy, layer)


def build_stack(main_path: Path, row_paths: list[Path]) -> Image.Image:
    main = Image.open(main_path).convert("RGBA")
    inner_w = main.width - PAD * 2
    row_images, row_w, row_h = build_row_as_is(row_paths, inner_w)

    canvas_w = max(main.width, row_w + PAD * 2)
    canvas_h = main.height + SECTION_GAP + row_h + BOTTOM_PAD
    canvas = horizontal_gradient(canvas_w, canvas_h)

    mx = (canvas_w - main.width) // 2
    paste_layer(canvas, main, (mx, 0))

    y = main.height + SECTION_GAP
    x = PAD + (canvas_w - PAD * 2 - row_w) // 2
    for im in row_images:
        ty = y + (row_h - im.height) // 2
        canvas.paste(im, (x, ty))
        x += im.width + IMAGE_GAP

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
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--main", required=True, help="Top grid PNG (tools/assets/collage-main-grid-2026.png)")
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
