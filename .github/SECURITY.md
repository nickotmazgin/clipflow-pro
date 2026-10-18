# Security Policy

## Supported Versions

Security fixes go into the **latest release only** (currently **1.5.8**). Older releases stay on GitHub for history; please upgrade to the latest.

| Version | Supported          |
| ------- | ------------------ |
| Latest 1.5.x (1.5.8) | :white_check_mark: |
| Older 1.5.x | :x: upgrade to latest |
| 1.4.x   | :x:                |
| < 1.4   | :x:                |

**Platforms:** GNOME Shell **45–51** on **Wayland** (supported) and **X11/Xorg** (supported; **v1.5.8 validated** on maintainer X11 setup). See [README](../README.md#compatibility).

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

1. **DO NOT** open a public issue
2. Email the details to: nickotmazgin.dev@gmail.com
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: As soon as possible depending on severity

## Security Best Practices

When reporting security issues, please:
- Provide clear and concise information
- Allow sufficient time for a fix to be developed
- Do not disclose the vulnerability publicly until a fix is released

## Security Features

ClipFlow Pro implements the following security measures:

- Local-only storage (no cloud sync)
- No network connections from the extension
- Clips a password manager marks as secret (KeePassXC and others) are not saved, plus heuristic filtering of password-like / sensitive-looking content (on by default)
- Secure file permissions for history storage (`0o600` / `0o700` where applied)
- Optional sensitive-entry auto-clearing
- No clipboard data transmission off-device
- Privacy-first, open-source design

For more details, see [docs/SECURITY_PRIVACY.md](../docs/SECURITY_PRIVACY.md).
