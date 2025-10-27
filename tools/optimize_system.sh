#!/usr/bin/env bash
#
# System maintenance helper focused on memory pressure and log cleanup.
# Run this as root: sudo ./tools/optimize_system.sh

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script with sudo or as the root user." >&2
  exit 1
fi

log() { printf '[optimize] %s\n' "$*"; }

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
if command -v nproc >/dev/null 2>&1; then
  DEFAULT_STREAMS="$(nproc)"
else
  DEFAULT_STREAMS="1"
fi
EARLYOOM_MEM="${EARLYOOM_MEM:-8}"
EARLYOOM_SWAP="${EARLYOOM_SWAP:-8}"
ZRAM_PERCENT="${ZRAM_PERCENT:-50}"
ZRAM_PRIORITY="${ZRAM_PRIORITY:-100}"
ZRAM_ALGO="${ZRAM_ALGO:-zstd}"
ZRAM_STREAMS="${ZRAM_STREAMS:-$DEFAULT_STREAMS}"
JOURNAL_VACUUM_SIZE="${JOURNAL_VACUUM_SIZE:-150M}"

log "Configuring earlyoom thresholds to ${EARLYOOM_MEM}% memory / ${EARLYOOM_SWAP}% swap."
mkdir -p /etc/systemd/system/earlyoom.service.d
cat <<EOF >/etc/systemd/system/earlyoom.service.d/override.conf
[Service]
ExecStart=
ExecStart=/usr/bin/earlyoom -r 3600 -m ${EARLYOOM_MEM} -s ${EARLYOOM_SWAP}
EOF

systemctl daemon-reload
if ! systemctl restart earlyoom; then
  log "Warning: could not restart earlyoom (it may not be installed)."
fi

log "Installing optimized zram handler (algo=${ZRAM_ALGO}, percent=${ZRAM_PERCENT}%, priority=${ZRAM_PRIORITY}, streams=${ZRAM_STREAMS})."
mkdir -p /usr/local/sbin
cat <<'EOF' >/usr/local/sbin/init-zram-swapping-optimized
#!/usr/bin/env bash
set -euo pipefail

DEVICE="${ZRAM_DEVICE:-/dev/zram0}"
PERCENT="${ZRAM_PERCENT:-50}"
PRIORITY="${ZRAM_PRIORITY:-100}"
ALGO="${ZRAM_ALGO:-zstd}"
if command -v nproc >/dev/null 2>&1; then
  DEFAULT_STREAMS="$(nproc)"
else
  DEFAULT_STREAMS="1"
fi
STREAMS="${ZRAM_STREAMS:-$DEFAULT_STREAMS}"

if ! command -v zramctl >/dev/null 2>&1; then
  echo "[zram] zramctl not available; aborting." >&2
  exit 1
fi

if ! modprobe zram 2>/dev/null; then
  echo "[zram] Failed to load zram kernel module." >&2
  exit 1
fi

# Turn off existing zram swap entries.
current_devices=$(swapon --noheadings --raw 2>/dev/null | awk '{print $1}' | grep '^/dev/zram' || true)
if [[ -n "${current_devices}" ]]; then
  while read -r dev; do
    [[ -n "$dev" ]] || continue
    swapoff "$dev" 2>/dev/null || true
    zramctl --reset "$dev" 2>/dev/null || true
  done <<<"${current_devices}"
fi

# Ensure target device is reset before reconfiguration.
zramctl --reset "${DEVICE}" 2>/dev/null || true

mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
size_mb=$(( mem_kb * PERCENT / 100 / 1024 ))
if (( size_mb < 64 )); then
  size_mb=64
fi

available=$(tr -d '[]' </sys/block/${DEVICE##*/}/comp_algorithm)
if ! grep -qw "${ALGO}" <<<"${available}"; then
  echo "[zram] Requested algorithm '${ALGO}' not supported. Available: ${available}" >&2
  exit 1
fi

dev=$(zramctl --find --size "${size_mb}M" --algorithm "${ALGO}" --streams "${STREAMS}")
mkswap "${dev}"
swapon --priority "${PRIORITY}" "${dev}"
echo "[zram] Initialized ${dev}: ${size_mb}M via ${ALGO} (priority ${PRIORITY}, streams ${STREAMS})."
EOF
chmod 0755 /usr/local/sbin/init-zram-swapping-optimized

mkdir -p /etc/systemd/system/zram-config.service.d
cat <<'EOF' >/etc/systemd/system/zram-config.service.d/override.conf
[Service]
ExecStart=
ExecStart=/usr/local/sbin/init-zram-swapping-optimized
EOF

zram_devs=$(swapon --noheadings --raw 2>/dev/null | awk '{print $1}' | grep '^/dev/zram' || true)
if [[ -n "${zram_devs}" ]]; then
  log "Resetting active zram devices before reinitialisation."
  while read -r dev; do
    [[ -n "$dev" ]] || continue
    swapoff "$dev" 2>/dev/null || true
  done <<<"${zram_devs}"
fi

systemctl daemon-reload
if ! systemctl restart zram-config.service; then
  log "Warning: zram-config.service restart failed."
fi

log "Vacuuming journal to ${JOURNAL_VACUUM_SIZE}."
journalctl --vacuum-size="${JOURNAL_VACUUM_SIZE}" || log "Warning: journal vacuum failed."

if command -v apt-get >/dev/null 2>&1; then
  log "Cleaning apt package cache."
  apt-get clean || log "Warning: apt-get clean failed."
fi

if [[ "${DISABLE_CLAMAV:-0}" == "1" ]]; then
  if systemctl list-unit-files | grep -q '^clamav-daemon\.service'; then
    log "Disabling clamav-daemon.service (requested via DISABLE_CLAMAV=1)."
    systemctl disable --now clamav-daemon.service || log "Warning: could not disable clamav-daemon."
  else
    log "clamav-daemon.service not present; nothing to disable."
  fi
else
  log "clamav-daemon left enabled (set DISABLE_CLAMAV=1 to disable automatically)."
fi

log "All optimisation steps completed. Reboot is recommended."
