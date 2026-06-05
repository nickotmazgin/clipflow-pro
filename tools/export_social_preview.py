#!/usr/bin/env python3
"""Export a repo collage as 1280x640 GitHub social preview PNG."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

GRAD_LEFT = (255, 120, 40)
GRAD_MID = (40, 180, 90)
GRAD_RIGHT = (120, 60, 200)


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


def export_preview(src: Path, out: Path, tw: int = 1280, th: int = 640) -> None:
    collage = Image.open(src).convert("RGB")
    collage = collage.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=1))
    margin = 48
    canvas = horizontal_gradient(tw, th)
    scale = min((tw - margin * 2) / collage.width, (th - margin * 2) / collage.height)
    nw, nh = round(collage.width * scale), round(collage.height * scale)
    fitted = collage.resize((nw, nh), Image.Resampling.LANCZOS)
    mask = Image.new("L", (nw, nh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, nw, nh), radius=10, fill=255)
    fitted.putalpha(mask)
    x, y = (tw - nw) // 2, (th - nh) // 2
    canvas.paste(fitted, (x, y), fitted)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, "PNG", compress_level=1)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("-o", "--output", required=True)
    args = p.parse_args()
    export_preview(Path(args.src), Path(args.output))
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
