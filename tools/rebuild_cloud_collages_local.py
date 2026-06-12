#!/usr/bin/env python3
"""Rebuild all three repo collages + GitHub social previews (local only, cloud backdrop)."""
from __future__ import annotations

import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

from PIL import Image  # noqa: E402

from make_collage_2026 import (  # noqa: E402
    build_clipflow,
    build_easehub_jpegs,
    build_numeric_jpegs,
    cloud_background,
    export_social,
    save_jpeg,
    save_png,
)

DEV = Path.home() / "dev"
PICTURES = Path.home() / "Pictures" / "Screenshots"
CLIPFLOW_GRID = PICTURES / "clipflow pro 2026" / "collage-grid"
# EaseHub HD tiles: m1.png … m6.png (NOT clipflow grid, NOT easehub 2026/1.png)
EASEHUB_TILE_PNGS = PICTURES
NUMERIC_TILE_PNGS = PICTURES


def sync_easehub_jpegs_from_png(repo: Path) -> None:
    """Refresh screenshots/m1.jpg … m6.jpg from ~/Pictures/Screenshots/m*.png."""
    shots = repo / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    for i in range(1, 7):
        src = EASEHUB_TILE_PNGS / f"m{i}.png"
        if not src.is_file():
            raise SystemExit(f"Missing EaseHub tile source (expected m*.png): {src}")
        dest = shots / f"m{i}.jpg"
        Image.open(src).convert("RGB").save(
            dest, "JPEG", quality=92, subsampling=0, optimize=True,
        )
        print(f"  synced {src.name} -> {dest.relative_to(repo)}")


def sync_numeric_jpegs_from_png(repo: Path) -> None:
    """Refresh screenshots/c1.jpg … c5.jpg from ~/Pictures/Screenshots/c*.png."""
    shots = repo / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    for i in range(1, 6):
        src = NUMERIC_TILE_PNGS / f"c{i}.png"
        if not src.is_file():
            raise SystemExit(f"Missing Numeric Clock tile source: {src}")
        dest = shots / f"c{i}.jpg"
        Image.open(src).convert("RGB").save(
            dest, "JPEG", quality=92, subsampling=0, optimize=True,
        )
        print(f"  synced {src.name} -> {dest.relative_to(repo)}")


def rebuild_clipflow() -> None:
    repo = DEV / "clipflow-pro"
    if not CLIPFLOW_GRID.is_dir():
        raise SystemExit(f"Missing ClipFlow grid: {CLIPFLOW_GRID}")
    collage = build_clipflow(CLIPFLOW_GRID)
    collage_jpg = repo / "screenshots" / "collage-v1.4.2-2026.jpg"
    social = repo / ".github" / "social-preview.png"
    save_jpeg(collage, collage_jpg, quality=93)
    save_png(export_social(collage, 1280, 640, seed=111), social)
    print(f"ClipFlow: {collage_jpg} ({collage.width}x{collage.height})")
    print(f"ClipFlow social: {social}")


def rebuild_easehub() -> None:
    repo = DEV / "comfort-control-easehub"
    shots = repo / "screenshots"
    print("EaseHub: syncing m1.png … m6.png -> screenshots/m*.jpg")
    sync_easehub_jpegs_from_png(repo)
    collage = build_easehub_jpegs(shots)
    collage_jpg = shots / "collage.jpg"
    social = repo / ".github" / "social-preview.png"
    save_jpeg(collage, collage_jpg, quality=92)
    save_png(export_social(collage, 1280, 640, seed=222), social)
    print(f"EaseHub: {collage_jpg} ({collage.width}x{collage.height})")
    print(f"EaseHub social: {social}")


def rebuild_numeric() -> None:
    repo = DEV / "Linux-Numeric-Date-And-Clock"
    shots = repo / "screenshots"
    print("Numeric Clock: syncing c1.png … c5.png -> screenshots/c*.jpg")
    sync_numeric_jpegs_from_png(repo)
    collage = build_numeric_jpegs(shots)
    collage_jpg = shots / "collage.jpg"
    social = repo / ".github" / "social-preview.png"
    save_jpeg(collage, collage_jpg, quality=92)
    save_png(export_social(collage, 1280, 640, seed=333), social)
    print(f"Numeric Clock: {collage_jpg} ({collage.width}x{collage.height})")
    print(f"Numeric Clock social: {social}")


def preview_background() -> None:
    preview = PICTURES / "cloud-background-preview.jpg"
    bg = cloud_background(2400, 1350, seed=77)
    save_jpeg(bg, preview, quality=95)
    print(f"Background preview only: {preview}")


def main() -> None:
    preview_background()
    rebuild_clipflow()
    rebuild_easehub()
    rebuild_numeric()
    print("\nLocal cloud collages ready — review before push.")


if __name__ == "__main__":
    main()
