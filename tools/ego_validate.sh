#!/usr/bin/env bash
set -euo pipefail

ZIP="dist/clipflow-pro@nickotmazgin.github.io.shell-extension.zip"
REQ=("metadata.json" "extension.js" "prefs.js" "stylesheet.css" "schemas/gschemas.compiled" "schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml" "icons/clipflow-pro-symbolic.svg")

fail() { echo "❌ $*" >&2; exit 1; }
warn() { echo "⚠️  $*" >&2; }
ok()   { echo "✅ $*"; }

[ -f "$ZIP" ] || fail "Zip not found: $ZIP. Run 'make dist' first."

# List zip entries once (portable)
ENTRIES=$(unzip -Z1 "$ZIP")

# Ensure flat layout (no top-level UUID dir)
if printf '%s\n' "$ENTRIES" | grep -qE '^clipflow-pro@nickotmazgin\.github\.io/'; then
  fail "Zip contains nested UUID directory; expected flat top-level files."
fi

# Check required files
for f in "${REQ[@]}"; do
  printf '%s\n' "$ENTRIES" | grep -qx "$f" || fail "Missing required file: $f"
done

ok "Required files present"

# Extract metadata.json to temp and validate JSON
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
unzip -p "$ZIP" metadata.json > "$TMPDIR/metadata.json"

if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool "$TMPDIR/metadata.json" >/dev/null || fail "metadata.json is not valid JSON"
else
  warn "python3 not found; skipping strict JSON check"
fi

# Basic metadata sanity
UUID=$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("uuid",""))' "$TMPDIR/metadata.json")
[ "$UUID" = "clipflow-pro@nickotmazgin.github.io" ] || fail "metadata.json uuid mismatch: $UUID"

SHELLS=$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(",".join(map(str,d.get("shell-version",[]))))' "$TMPDIR/metadata.json")
echo "Shell versions: [$SHELLS]"

VER=$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("version"))' "$TMPDIR/metadata.json")
[[ "$VER" =~ ^[0-9]+$ ]] || fail "metadata.json version is not an integer: $VER"

VNAME=$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("version-name",""))' "$TMPDIR/metadata.json")
[ -n "$VNAME" ] || warn "metadata.json version-name missing"

ok "metadata.json passes basic checks (uuid/version/version-name/shell-version)"

# Validate schema id matches metadata settings-schema
unzip -p "$ZIP" schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml > "$TMPDIR/schema.xml"
SCHEMA_ID=$(python3 -c 'import xml.etree.ElementTree as ET,sys;tree=ET.parse(sys.argv[1]);root=tree.getroot();s=root.find("schema");print(s.get("id") if s is not None else "")' "$TMPDIR/schema.xml")
[ "$SCHEMA_ID" = "org.gnome.shell.extensions.clipflow-pro" ] || fail "Schema id mismatch: $SCHEMA_ID"
ok "Schema id matches"

echo "--- extension.js constructor check ---"
unzip -p "$ZIP" extension.js | grep -n "export default class" -n || warn "No default export class found"
unzip -p "$ZIP" extension.js | grep -En "constructor\s*\(\s*metadata\s*\)" >/dev/null || fail "Extension constructor(metadata) not found"
unzip -p "$ZIP" extension.js | grep -En "super\s*\(\s*metadata\s*\)" >/dev/null || fail "Extension constructor does not call super(metadata)"
ok "Extension constructor calls super(metadata)"

echo "All checks passed."
