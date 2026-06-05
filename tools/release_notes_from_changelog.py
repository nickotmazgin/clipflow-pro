#!/usr/bin/env python3
"""Extract a GitHub release notes body from CHANGELOG.md for VERSION."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = REPO_ROOT / "CHANGELOG.md"

FOOTER = """
## Install
Download the **`clipflow-pro@nickotmazgin.github.io-*-gs45-50.zip`** asset (GNOME Shell **45–50**), install with `gnome-extensions install --force`, enable, then Alt+F2 → r → Enter.

## GNOME 43–44 — discontinued
ClipFlow Pro **no longer supports GNOME Shell 43–44**. Use GNOME **45** or newer.
""".strip()


def section_for_version(text: str, version: str) -> str:
    header = re.compile(rf"^## {re.escape(version)}\s+—", re.MULTILINE)
    match = header.search(text)
    if not match:
        raise SystemExit(f"No CHANGELOG section for {version}")
    start = match.start()
    rest = text[start + 1 :]
    nxt = re.search(r"^## \d+\.\d+\.\d+\s+—", rest, re.MULTILINE)
    end = start + 1 + nxt.start() if nxt else len(text)
    block = text[start:end].strip()
    # GitHub release title already names the version; drop duplicate H2.
    block = re.sub(rf"^## {re.escape(version)}\s+—[^\n]*\n+", "", block, count=1)
    return block.strip()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {sys.argv[0]} <version e.g. 1.4.2>")
    version = sys.argv[1].lstrip("v")
    text = CHANGELOG.read_text(encoding="utf-8")
    body = section_for_version(text, version)
    print("## Highlights\n")
    print(body)
    print()
    print(FOOTER)


if __name__ == "__main__":
    main()
