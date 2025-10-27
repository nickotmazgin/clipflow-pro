#!/usr/bin/env bash
#
# system_security_hardening.sh
# -----------------------------
# Opinionated hardening helper tailored for this workstation:
#   • Refreshes package metadata and (optionally) installs security tooling
#   • Ensures UFW is enabled with a restrictive baseline rule-set
#   • Checks fail2ban and AppArmor status, enabling them if necessary
#   • Prints a concise security summary so you can verify at a glance
#
# Usage:
#   sudo ./tools/system_security_hardening.sh          # apply defaults
#   sudo ./tools/system_security_hardening.sh --no-upgrade   # skip apt upgrade
#

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script with sudo or as root." >&2
  exit 1
fi

NO_UPGRADE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-upgrade)
      NO_UPGRADE=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

log() { printf '[security] %s\n' "$*"; }

APT_PACKAGES=(
  ufw
  fail2ban
  apparmor
  apparmor-utils
  apparmor-profiles
)

if ! command -v ufw >/dev/null 2>&1; then
  log "Installing baseline security packages..."
  apt-get update -y
  apt-get install -y "${APT_PACKAGES[@]}"
else
  log "Refreshing apt metadata..."
  apt-get update -y
fi

if [[ "${NO_UPGRADE}" -eq 0 ]]; then
  log "Applying unattended package upgrades (security + bug-fix)..."
  apt-get dist-upgrade -y
else
  log "Skipping apt upgrade (per --no-upgrade)."
fi

log "Ensuring firewall defaults..."
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow from 127.0.0.0/8 comment 'Localhost loopback'
for port in 23 21 135 139 445 1433 3389 5900; do
  ufw deny "${port}/tcp" 2>/dev/null || true
done
ufw limit 22/tcp comment 'SSH (rate limited)'
# Allow KDE Connect LAN sync if the rule is missing
if ! ufw status | grep -q '1716.*ALLOW'; then
  ufw allow from 10.100.102.0/24 to any port 1716 comment 'KDE Connect LAN'
fi
ufw --force enable

log "Checking fail2ban service..."
if systemctl list-unit-files | grep -q '^fail2ban.service'; then
  systemctl enable --now fail2ban
else
  log "fail2ban package missing; installing..."
  apt-get install -y fail2ban
  systemctl enable --now fail2ban
fi

log "Ensuring AppArmor is in enforcing mode..."
systemctl enable --now apparmor

log "Security snapshot:"
echo "-----------------------------------------------------------------"
echo "UFW status:"
ufw status verbose
echo
echo "fail2ban summary:"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status || true
else
  echo "fail2ban-client not found"
fi
echo
echo "AppArmor status:"
if command -v aa-status >/dev/null 2>&1; then
  aa-status || true
else
  echo "aa-status not installed (install apparmor-utils for details)."
fi
echo "-----------------------------------------------------------------"

log "All hardening steps completed. Review the summary above and reboot if a kernel/AppArmor profile update was applied."
