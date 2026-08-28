# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.5.x   | :white_check_mark: |
| 1.4.x   | :x:                |
| < 1.4   | :x:                |

**Platforms:** GNOME Shell **45–50** on **Wayland** (supported) and **X11/Xorg** (supported; **v1.5.2 validated** on maintainer X11 setup). See [README](../README.md#compatibility).

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
- Heuristic filtering of password-like / sensitive-looking clipboard content (optional)
- Secure file permissions for history storage (`0o600` / `0o700` where applied)
- Optional sensitive-entry auto-clearing
- No clipboard data transmission off-device
- Privacy-first, open-source design

For more details, see [docs/SECURITY_PRIVACY.md](../docs/SECURITY_PRIVACY.md).
