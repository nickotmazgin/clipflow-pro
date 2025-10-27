#!/usr/bin/env bash
# repair_system.sh – cleanup for ClipFlow Pro host
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script with sudo or as root." >&2
  exit 1
fi

timestamp="$(date +%Y%m%d%H%M%S)"
log() { printf '[repair] %s\n' "$*"; }

declare -A BACKED_UP
backup_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  if [[ -z "${BACKED_UP[$file]:-}" ]]; then
    cp -a "$file" "${file}.bak.${timestamp}"
    BACKED_UP[$file]=1
    log "Backup saved: ${file}.bak.${timestamp}"
  fi
}

sanitize_sysctl_file() {
  local file="$1"; shift
  [[ -f "$file" ]] || return 0
  backup_file "$file"
  python3 - "$file" "$timestamp" "$@" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
stamp = sys.argv[2]
keys = sys.argv[3:]
text = path.read_text()
changed = False
for key in keys:
    pattern = re.compile(rf'^(\s*)(?!#)({re.escape(key)}\s*=)(.*)$', re.MULTILINE)
    text, count = pattern.subn(rf'\1# disabled {stamp}: \2\3', text)
    if count:
        changed = True
if changed:
    path.write_text(text)
PY
}

ensure_kv() {
  local file="$1" key="$2" value="$3"
  backup_file "$file"
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
key  = sys.argv[2]
value = sys.argv[3]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
pattern = re.compile(rf'^\s*{re.escape(key)}\s*=')
updated = False
for idx, line in enumerate(lines):
    if line.lstrip().startswith('#'):
        continue
    if pattern.match(line):
        lines[idx] = f"{key}={value}"
        updated = True
        break
if not updated:
    lines.append(f"{key}={value}")
path.write_text("\n".join(lines).rstrip() + "\n")
PY
}

log "1) Normalising zram configuration"
if systemctl list-unit-files | grep -q '^zramswap\.service'; then
  if systemctl is-enabled --quiet zramswap.service || systemctl is-active --quiet zramswap.service; then
    log "Disabling zramswap.service"
    systemctl disable --now zramswap.service || true
  else
    log "zramswap.service already disabled"
  fi
  systemctl reset-failed zramswap.service || true
else
  log "zramswap.service not installed; skipping"
fi

if systemctl list-unit-files | grep -q '^zram-config\.service'; then
  log "Ensuring zram-config.service is enabled and started"
  systemctl enable --now zram-config.service
else
  log "zram-config.service not found; skipping"
fi

log "Restarting active zram swap"
if systemctl is-active --quiet zram-config.service; then
  systemctl restart zram-config.service || true
fi

log "2) Commenting invalid sysctl keys"
SYSCTL_KEYS=(
  "kernel.modules_disabled"
  "net.ipv4.conf.all.accept_ra"
  "net.ipv4.conf.default.accept_ra"
  "net.ipv4.tcp_frto_response"
  "net.ipv4.tcp_no_delay_ack"
  "net.ipv4.tcp_thin_dupack"
)
SYSCTL_FILES=(
  /etc/sysctl.d/99-security-hardening.conf
  /etc/sysctl.d/99-security.conf
  /etc/sysctl.d/99-ipv4-security.conf
  /etc/sysctl.d/99-ipv6-privacy.conf
)
for file in "${SYSCTL_FILES[@]}"; do
  sanitize_sysctl_file "$file" "${SYSCTL_KEYS[@]}"
done
log "Reloading sysctl settings"
sysctl --system
systemctl reset-failed systemd-sysctl.service || true

log "3) Tuning earlyoom thresholds"
ensure_kv /etc/default/earlyoom MIN_FREE_MEM "8"
ensure_kv /etc/default/earlyoom MIN_FREE_SWAP "8"
systemctl restart earlyoom || true

log "4) Removing evbug and blacklisting"
if lsmod | grep -q '^evbug'; then
  modprobe -r evbug || true
  log "evbug module unloaded"
else
  log "evbug module already absent"
fi
blacklist_file=/etc/modprobe.d/blacklist-evbug.conf
if [[ ! -f "$blacklist_file" ]]; then
  printf '# Prevent kernel evbug spam (added %s)\nblacklist evbug\n' "$timestamp" > "$blacklist_file"
  log "Created $blacklist_file"
fi

log "5) Installing libinput quirk for SYNA2BA6 touchpad"
mkdir -p /etc/libinput
cat <<'EOF' > /etc/libinput/local-overrides.quirks
[Lenovo IdeaPad 1 15IJL7 Touchpad]
MatchName=SYNA2BA6:00 06CB:CE2D
AttrSizeHint=89x52
AttrTouchSizeRange=7:12
AttrPalmSizeThreshold=120
EOF
log "Libinput quirk written to /etc/libinput/local-overrides.quirks"

log "6) Resetting failed units"
systemctl reset-failed systemd-sysctl.service zramswap.service || true

log "7) Enforcing AppArmor profile for rsyslogd"
if command -v aa-enforce >/dev/null 2>&1; then
  profile_path="/etc/apparmor.d/usr.sbin.rsyslogd"
  if [[ -f "$profile_path" ]]; then
    aa-enforce "$profile_path" || log "Could not enforce $profile_path automatically"
    systemctl restart rsyslog || true
    if command -v aa-status >/dev/null 2>&1; then
      log "AppArmor status for rsyslogd:"
      aa-status 2>/dev/null | grep -A3 rsyslogd || log "Check manually with: sudo aa-status"
    else
      log "aa-status command not available; install apparmor-utils for detailed status"
    fi
  else
    log "AppArmor profile $profile_path not found; skipping enforcement"
  fi
else
  log "AppArmor tools not available; skipping"
fi

log "8) Tuning Fail2Ban SSH jail"
if [[ -d /etc/fail2ban ]]; then
  jail_local=/etc/fail2ban/jail.local
  if [[ ! -f "$jail_local" ]]; then
    cat > "$jail_local" <<'EOF'
[sshd]
enabled = true
bantime = 1h
findtime = 10m
maxretry = 4
EOF
    log "Created $jail_local with tightened SSH settings"
  else
    backup_file "$jail_local"
    # Check if [sshd] block exists
    if ! grep -q '^\[sshd\]' "$jail_local"; then
      cat >> "$jail_local" <<'EOF'

[sshd]
enabled = true
bantime = 1h
findtime = 10m
maxretry = 4
EOF
      log "Added [sshd] block to $jail_local"
    else
      log "$jail_local already has [sshd] section; manual review recommended"
    fi
  fi
  systemctl restart fail2ban || true
  log "Fail2Ban jail status:"
  fail2ban-client status sshd 2>/dev/null || log "Fail2Ban service check: sudo fail2ban-client status sshd"
else
  log "Fail2Ban not installed; skipping"
fi

log "9) Security recommendations"
log "- Review UFW logs: sudo tail -f /var/log/ufw.log"
log "- Turn off Bluetooth discovery after pairing: bluetoothctl discoverable off"
log "- Consider reviewing unnecessary UFW rules: sudo ufw status numbered"

log "All tasks done. Recommended next steps:"
log "- Reboot the system."
log "- After logging in, press Alt+F2 then 'r' to reload GNOME Shell."
log "- Recheck with 'systemctl --failed' and 'journalctl -b -p3'."
