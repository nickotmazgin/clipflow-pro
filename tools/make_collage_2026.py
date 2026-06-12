#!/usr/bin/env python3
"""Lossless PNG collages + HD social exports for GitHub and social networks."""
from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

TITLE_H = 140
TITLE_GAP = 40
PAD = 56
TILE_GAP = 52
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


def _paste_cloud_mass(
    layer: Image.Image,
    rng,
    w: int,
    h: int,
    cx: int,
    cy: int,
    rx: int,
    ry: int,
    color: tuple[int, int, int, int],
    blur: int,
) -> None:
    blob = Image.new("RGBA", (rx * 2, ry * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(blob)
    r, g, b, a = color
    draw.ellipse((0, 0, rx * 2 - 1, ry * 2 - 1), fill=color)
    # snow highlight on top-left of puff
    draw.ellipse(
        (rx // 4, ry // 5, rx + rx // 2, ry),
        fill=(min(255, r + 12), min(255, g + 12), 255, max(80, a // 2)),
    )
    blob = blob.filter(ImageFilter.GaussianBlur(blur))
    layer.paste(blob, (cx - rx, cy - ry), blob)


AURORA_COLORS = (
    (0, 255, 110, 255),    # vivid emerald
    (20, 255, 200, 240),   # teal
    (80, 220, 255, 230),   # icy cyan
    (190, 60, 255, 220),   # violet
    (255, 70, 200, 210),   # aurora pink
    (120, 255, 160, 225),  # mint glow
)


def _screen_blend(base: Image.Image, glow: Image.Image, strength: float = 1.0) -> Image.Image:
    """Add glow using screen blend; strength 0–1 scales glow intensity."""
    if strength < 1.0:
        glow = Image.blend(Image.new("RGB", glow.size, (0, 0, 0)), glow, strength)
    return ImageChops.screen(base.convert("RGB"), glow.convert("RGB"))


def _aurora_curtain_rgb(
    layer: Image.Image,
    rng,
    w: int,
    h: int,
    cx: int,
    top: float,
    bottom: float,
    color: tuple[int, int, int],
) -> None:
    """Vertical wavy aurora ribbon drawn on RGB (blur-safe)."""
    ribbon = Image.new("RGB", (w, h), (0, 0, 0))
    draw = ImageDraw.Draw(ribbon)
    steps = rng.randint(14, 22)
    phase = rng.uniform(0, math.pi * 2)
    freq = rng.uniform(1.8, 3.6)
    sway = rng.randint(w // 14, w // 7)
    thickness = rng.randint(max(32, w // 36), max(64, w // 16))
    y_top = int(top * h)
    y_bot = int(bottom * h)
    r, g, b = color
    for i in range(steps + 1):
        t = i / steps
        y = int(y_top + (y_bot - y_top) * t)
        wave = int(math.sin(t * math.pi * freq + phase) * sway)
        drift = int((t - 0.35) * sway * 0.6)
        x = cx + wave + drift
        fade = 0.55 + 0.45 * math.sin(t * math.pi)
        fill = (int(r * fade), int(g * fade), int(b * fade))
        draw.ellipse(
            (x - thickness, y - thickness // 2, x + thickness, y + thickness // 2),
            fill=fill,
        )
        draw.ellipse(
            (x - thickness // 2, y - thickness, x + thickness // 2, y + thickness),
            fill=(min(255, fill[0] + 30), min(255, fill[1] + 35), min(255, fill[2] + 40)),
        )
    blur = rng.randint(max(22, w // 36), max(48, w // 20))
    blurred = ribbon.filter(ImageFilter.GaussianBlur(blur))
    layer.paste(ImageChops.add(layer, blurred))


def _aurora_glow_rgb(layer: Image.Image, rng, w: int, h: int) -> None:
    """Soft horizontal aurora glow bands across the upper sky."""
    for y_frac, color in (
        (0.06, (20, 255, 120)),
        (0.16, (40, 230, 255)),
        (0.26, (200, 70, 255)),
        (0.38, (255, 80, 200)),
    ):
        cy = int(h * y_frac + rng.randint(-h // 40, h // 40))
        rx = w // 2 + rng.randint(w // 10, w // 4)
        ry = rng.randint(h // 8, h // 5)
        blob = Image.new("RGB", (rx * 2, ry * 2), (0, 0, 0))
        ImageDraw.Draw(blob).ellipse((0, 0, rx * 2 - 1, ry * 2 - 1), fill=color)
        blob = blob.filter(ImageFilter.GaussianBlur(rng.randint(40, 70)))
        patch = Image.new("RGB", (w, h), (0, 0, 0))
        patch.paste(blob, (w // 2 - rx + rng.randint(-w // 8, w // 8), cy - ry))
        layer.paste(ImageChops.add(layer, patch))


def _aurora_rgb_layer(w: int, h: int, rng, seed_offset: int = 0) -> Image.Image:
    """Build a bright RGB aurora layer for screen blending."""
    import random

    sub_rng = random.Random(seed_offset)
    aurora = Image.new("RGB", (w, h), (0, 0, 0))
    _aurora_glow_rgb(aurora, sub_rng, w, h)
    x_slots = [int(w * f) for f in (0.06, 0.18, 0.32, 0.48, 0.62, 0.76, 0.9)]
    sub_rng.shuffle(x_slots)
    for i in range(sub_rng.randint(7, 10)):
        cx = x_slots[i % len(x_slots)] + sub_rng.randint(-w // 14, w // 14)
        top = sub_rng.uniform(0.0, 0.1)
        bottom = sub_rng.uniform(0.5, 0.9)
        color = AURORA_COLORS[i % len(AURORA_COLORS)][:3]
        _aurora_curtain_rgb(aurora, sub_rng, w, h, cx, top, bottom, color)
    return aurora


def cloud_background(w: int, h: int, seed: int = 42) -> Image.Image:
    """Alaskan night — aurora borealis, snow-grey clouds on a cool dark sky."""
    import random

    rng = random.Random(seed)

    # Cool twilight sky with faint aurora tint in the upper half
    sky = Image.new("RGB", (w, h))
    px = sky.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        aur = max(0.0, 1.0 - t * 1.35)
        r = int(12 + t * 20 + aur * 18)
        g = int(18 + t * 26 + aur * 42)
        b = int(30 + t * 34 + aur * 28)
        for x in range(w):
            px[x, y] = (r, g, b)

    out = _screen_blend(sky, _aurora_rgb_layer(w, h, rng, seed + 1000), strength=1.0).convert("RGBA")

    # soft grey cloud masses (semi-transparent so aurora shows through)
    bands = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for _ in range(6):
        cy = rng.randint(h // 10, h - h // 10)
        rx = rng.randint(w // 3, w // 2 + w // 6)
        ry = rng.randint(h // 10, h // 4)
        grey = rng.randint(155, 220)
        _paste_cloud_mass(
            bands, rng, w, h,
            rng.randint(-w // 10, w + w // 10), cy,
            rx, ry,
            (grey, grey + 10, grey + 20, rng.randint(55, 95)),
            blur=rng.randint(50, 90),
        )
    out = Image.alpha_composite(out, bands)
    out = _screen_blend(out.convert("RGB"), _aurora_rgb_layer(w, h, rng, seed + 2000), strength=0.62).convert("RGBA")

    # big bright snow-white puffs
    snow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for _ in range(24):
        rx = rng.randint(max(160, w // 7), max(320, w // 2))
        ry = rng.randint(max(70, h // 14), max(180, h // 3))
        _paste_cloud_mass(
            snow, rng, w, h,
            rng.randint(-w // 8, w + w // 8),
            rng.randint(-h // 10, h + h // 10),
            rx, ry,
            (
                rng.randint(228, 252),
                rng.randint(232, 254),
                rng.randint(240, 255),
                rng.randint(70, 130),
            ),
            blur=rng.randint(40, 75),
        )
    out = Image.alpha_composite(out, snow)

    # wispy snow streaks (upper sky)
    wispy = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for _ in range(16):
        rx = rng.randint(w // 3, w)
        ry = rng.randint(h // 25, h // 12)
        streak = Image.new("RGBA", (rx * 2, ry * 2), (0, 0, 0, 0))
        ImageDraw.Draw(streak).ellipse(
            (0, 0, rx * 2 - 1, ry * 2 - 1),
            fill=(245, 248, 255, rng.randint(90, 150)),
        )
        streak = streak.filter(ImageFilter.GaussianBlur(rng.randint(18, 42)))
        wispy.paste(
            streak,
            (rng.randint(-w // 10, w // 2), rng.randint(0, h // 4)),
            streak,
        )
    out = Image.alpha_composite(out, wispy)

    # final aurora wash — keeps greens / purples visible in gaps
    final_aurora = _aurora_rgb_layer(w, h, rng, seed + 3000).filter(ImageFilter.GaussianBlur(18))
    out = _screen_blend(out.convert("RGB"), final_aurora, strength=0.48)

    shade = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle((0, 0, w, h), fill=(2, 6, 12, 12))
    out = Image.alpha_composite(out.convert("RGBA"), shade)
    return out.convert("RGB")


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


def compose_grid(
    rows: list[list[Image.Image]],
    title: str | None = None,
    subtitle: str | None = None,
    *,
    seed: int = 42,
) -> Image.Image:
    row_widths = [sum(t.width for t in row) + TILE_GAP * (len(row) - 1) for row in rows]
    row_heights = [max(t.height for t in row) for row in rows]
    grid_w, grid_h = max(row_widths), sum(row_heights) + TILE_GAP * (len(rows) - 1)
    has_title = bool(title)
    if has_title:
        total_w, total_h = grid_w + PAD * 2, TITLE_H + TITLE_GAP + grid_h + PAD
    else:
        total_w, total_h = grid_w + PAD * 2, grid_h + PAD * 2
    canvas = cloud_background(total_w, total_h, seed=seed)
    if has_title:
        draw_title(canvas, title, subtitle or "")
        y0 = TITLE_H + TITLE_GAP + PAD // 2
    else:
        y0 = PAD
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
    elif n == 8:
        rows = [tiles[0:4], tiles[4:8]]
    else:
        rows = [tiles[0:5], tiles[5:10]]
    return compose_grid(rows, meta["title"], meta["subtitle"], seed=11)


def build_numeric(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    banner = tile(imgs[0], 2000, 120, allow_upscale=True)
    return compose_grid(
        [[banner], [tile_native(imgs[1]), tile_native(imgs[2])]],
        seed=33,
    )


def build_easehub(src: Path) -> Image.Image:
    imgs = load_numbered_images(src)
    top = [tile_native(imgs[0]), tile_native(imgs[1])]
    bottom = [tile_native(imgs[2]), tile_native(imgs[3]), tile_native(imgs[4])]
    return compose_grid([top, bottom], seed=22)


def load_jpg_series(shots_dir: Path, names: list[str]) -> list[Image.Image]:
    out: list[Image.Image] = []
    for name in names:
        path = shots_dir / name
        if not path.exists():
            raise SystemExit(f"Missing tile: {path}")
        out.append(Image.open(path).convert("RGBA"))
    return out


def build_easehub_jpegs(shots_dir: Path) -> Image.Image:
    names = [f"m{i}.jpg" for i in range(1, 7)]
    tiles = [tile_native(im) for im in load_jpg_series(shots_dir, names)]
    return compose_grid([tiles[0:3], tiles[3:6]], seed=22)


def build_numeric_jpegs(shots_dir: Path) -> Image.Image:
    names = [f"c{i}.jpg" for i in range(1, 6)]
    tiles = [tile_native(im) for im in load_jpg_series(shots_dir, names)]
    return compose_grid([tiles[0:2], tiles[2:5]], seed=33)


BUILDERS = {"clipflow": build_clipflow, "numeric": build_numeric, "easehub": build_easehub}


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, "PNG", compress_level=1, optimize=False)


def save_jpeg(img: Image.Image, path: Path, quality: int = 92) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = sharpen(img.convert("RGB"))
    out.save(path, "JPEG", quality=quality, subsampling=0, optimize=True)


def export_social(collage: Image.Image, tw: int, th: int, seed: int = 99) -> Image.Image:
    """Fit collage inside canvas with cloud letterbox, rounded corners, and shadow."""
    margin = 48
    canvas = cloud_background(tw, th, seed=seed)
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
