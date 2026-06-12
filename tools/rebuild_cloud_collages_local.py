#!/usr/bin/env python3
"""Rebuild all three repo collages + GitHub social previews (local only, cloud backdrop)."""
from __future__ import annotations

import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

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
