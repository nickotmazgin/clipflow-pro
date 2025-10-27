# Development Tools

This directory now holds only the maintained helper scripts that are still relevant to the ClipFlow Pro workflow.  
All of them are optional—end users do not need these to install or run the extension.

- `clean_workspace.sh` – removes build artefacts and leftover backup files from the repo tree.
- `kitty_overhaul.sh` – reinstalls the Kitty profile with curated shortcuts, themes, and kittens.
- `optimize_system.sh` – trims caches, retunes zram/earlyoom, and vacuums logs on the development machine.
- `repair_system.sh` – one-stop maintenance script that normalises zram, fixes sysctl noise, and applies GNOME shell quirks.
- `system_security_hardening.sh` – refreshes packages, locks down UFW/fail2ban, and reports AppArmor status.

If you add a new helper script, please document it here so the directory stays organised.
