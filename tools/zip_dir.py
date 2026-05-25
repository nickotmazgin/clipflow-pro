#!/usr/bin/env python3
"""Create deterministic zip archives without requiring the system zip binary."""

from __future__ import annotations

import argparse
import fnmatch
from pathlib import Path
import stat
import zipfile


def normalize(path: Path | str) -> str:
    return str(path).replace("\\", "/").strip("/")


def is_excluded(relative_path: str, patterns: list[str]) -> bool:
    relative_path = normalize(relative_path)
    for pattern in patterns:
        pattern = normalize(pattern)
        if not pattern:
            continue
        if fnmatch.fnmatch(relative_path, pattern):
            return True
        if relative_path == pattern or relative_path.startswith(f"{pattern}/"):
            return True
    return False


def add_file(archive: zipfile.ZipFile, source: Path, archive_name: str) -> None:
    info = zipfile.ZipInfo(normalize(archive_name))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (source.stat().st_mode & 0xFFFF) << 16
    if source.stat().st_mode & stat.S_IXUSR:
        info.external_attr |= 0o755 << 16
    with source.open("rb") as handle:
        archive.writestr(info, handle.read())


def iter_source_files(root: Path, source: Path) -> list[tuple[Path, str]]:
    if source.is_file():
        return [(source, normalize(source.relative_to(root)))]

    files: list[tuple[Path, str]] = []
    for path in sorted(source.rglob("*")):
        if path.is_file():
            files.append((path, normalize(path.relative_to(root))))
    return files


def create_archive(root: Path, destination: Path, sources: list[Path], excludes: list[str]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        destination.unlink()

    with zipfile.ZipFile(destination, "w") as archive:
        seen: set[str] = set()
        for source in sources:
            source = source.resolve()
            if not source.exists():
                continue
            for path, archive_name in iter_source_files(root, source):
                if is_excluded(archive_name, excludes) or archive_name in seen:
                    continue
                add_file(archive, path, archive_name)
                seen.add(archive_name)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="Root directory used for archive paths")
    parser.add_argument("destination", type=Path, help="Zip archive to write")
    parser.add_argument("sources", nargs="+", type=Path, help="Files or directories to include")
    parser.add_argument("--exclude", action="append", default=[], help="Path or glob to exclude")
    args = parser.parse_args()

    root = args.root.resolve()
    sources = [(root / source).resolve() if not source.is_absolute() else source for source in args.sources]
    create_archive(root, args.destination.resolve(), sources, args.exclude)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
