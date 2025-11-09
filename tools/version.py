#!/usr/bin/env python3
"""ClipFlow Pro version management helpers."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
METADATA_PATH = REPO_ROOT / "metadata.json"


def read_metadata() -> dict:
    try:
        return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"metadata.json not found at {METADATA_PATH}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"metadata.json is not valid JSON: {exc}") from exc


def write_metadata(data: dict) -> None:
    METADATA_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def cmd_show(_args: argparse.Namespace) -> None:
    data = read_metadata()
    version = data.get("version", "unknown")
    version_name = data.get("version-name", "n/a")
    print(f"Current version: {version} ({version_name})")


def cmd_bump(_args: argparse.Namespace) -> None:
    data = read_metadata()
    if "version" not in data:
        raise SystemExit("metadata.json is missing a 'version' field")

    version = data["version"]
    if not isinstance(version, int):
        raise SystemExit("ClipFlow Pro requires the numeric 'version' field to be an integer.")

    data["version"] = version + 1
    write_metadata(data)
    print(f"Version bumped from {version} to {data['version']}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ClipFlow Pro version helpers")
    subparsers = parser.add_subparsers(dest="command", required=True)

    show_parser = subparsers.add_parser("show", help="Print metadata.json version information")
    show_parser.set_defaults(func=cmd_show)

    bump_parser = subparsers.add_parser("bump", help="Increase the integer version in metadata.json by one")
    bump_parser.set_defaults(func=cmd_bump)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
