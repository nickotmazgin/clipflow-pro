#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
UUID="clipflow-pro@nickotmazgin.github.io"

# Derive version info from root metadata.json
VERSION_BASE=$(python3 - <<'PYEOF'
import json
with open('metadata.json','r',encoding='utf-8') as f:
    m=json.load(f)
vn=(m.get('version-name') or '').strip()
print(vn.split()[0] if vn else '1.3.7')
PYEOF
)
VERSION_NUM=$(python3 - <<'PYEOF'
import json
with open('metadata.json','r',encoding='utf-8') as f:
    m=json.load(f)
print(m.get('version', 1))
PYEOF
)

mkdir -p "${DIST_DIR}"

echo "Creating GNOME 43-44 zip..."
cd "${ROOT_DIR}/build-43-44"
python3 - <<PYEOF
import json
from pathlib import Path
m = json.loads(Path('metadata.json').read_text(encoding='utf-8'))
m['shell-version'] = ['43','44']
m['version-name'] = '${VERSION_BASE}'
m['version'] = int('${VERSION_NUM}')
Path('metadata.json').write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')
PYEOF
zip -qry "${DIST_DIR}/${UUID}-${VERSION_BASE}-gs43-44.zip" .

echo "Creating GNOME 45-47 zip..."
TMP45=$(mktemp -d)
trap "rm -rf '${TMP45}'" EXIT

cp "${ROOT_DIR}/stylesheet.css" "${ROOT_DIR}/LICENSE" "${TMP45}/"
cp "${ROOT_DIR}/extension-esm.js" "${TMP45}/extension.js"
cp "${ROOT_DIR}/extension.js" "${TMP45}/legacy.js"
cp "${ROOT_DIR}/prefs-es6.js" "${TMP45}/prefs.js"
cp -r "${ROOT_DIR}/icons" "${ROOT_DIR}/schemas" "${TMP45}/" 2>/dev/null || true
cp "${ROOT_DIR}/metadata.json" "${TMP45}/metadata.json"

python3 <<PYEOF
import json
with open('${TMP45}/metadata.json', 'r') as f:
    m = json.load(f)
m['shell-version'] = ['45', '46', '47']
m['version-name'] = '${VERSION_BASE} 45.47'
m['version'] = ${VERSION_NUM}
with open('${TMP45}/metadata.json', 'w') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
PYEOF

cd "${TMP45}"
zip -qry "${DIST_DIR}/${UUID}-${VERSION_BASE}-gs45-47.zip" .

echo "Done! Created:"
echo "  - ${DIST_DIR}/${UUID}-${VERSION_BASE}-gs43-44.zip"
echo "  - ${DIST_DIR}/${UUID}-${VERSION_BASE}-gs45-47.zip"
