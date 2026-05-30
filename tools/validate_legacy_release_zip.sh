#!/usr/bin/env bash
set -euo pipefail

Z="${1:-clipflow-pro@nickotmazgin.github.io.shell-extension.zip}"
[ -f "$Z" ] || { echo "Zip not found: $Z"; exit 1; }

unzip -Z1 "$Z" > entries.txt
req=(
  metadata.json
  extension.js
  prefs.js
  stylesheet.css
  schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml
  icons/clipflow-pro-symbolic.svg
)
for f in "${req[@]}"; do
  grep -qx "$f" entries.txt || { echo "Missing required file: $f"; exit 1; }
done

if grep -q "^schemas/gschemas.compiled$" entries.txt; then
  echo "schemas/gschemas.compiled must NOT be shipped"
  exit 1
fi

unzip -p "$Z" metadata.json > meta.json
python3 -m json.tool meta.json >/dev/null
uuid=$(jq -r '.uuid' meta.json)
ver=$(jq -r '.version' meta.json)
vname=$(jq -r '."version-name" // empty' meta.json)
shells=$(jq -r '."shell-version"|join(",")' meta.json)

[ "$uuid" = "clipflow-pro@nickotmazgin.github.io" ] || { echo "UUID mismatch: $uuid"; exit 1; }
[[ "$ver" =~ ^[0-9]+$ ]] || { echo "version must be integer"; exit 1; }

if [ -n "$vname" ]; then
  python3 -c "import sys; name=sys.argv[1]; name.encode('ascii'); n=len(name); print(n); sys.exit(1 if n>16 else 0)" "$vname" || {
    echo "version-name must be ASCII and <=16 chars"
    exit 1
  }
fi

[ "$shells" = "43,44" ] || { echo "shell-version must be 43,44 (got $shells)"; exit 1; }

unzip -p "$Z" schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml > schema.xml
python3 -c "import xml.etree.ElementTree as ET; root=ET.parse('schema.xml').getroot(); s=root.find('schema'); assert s is not None and s.get('id')=='org.gnome.shell.extensions.clipflow-pro'"

echo "Legacy release zip validation passed."
