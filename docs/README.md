# Developer Documentation Index

This directory collects internal notes and helper material for ClipFlow Pro development and maintenance.
It is not required for end users of the extension.

## Documents in this folder

- [MAINTENANCE.md](MAINTENANCE.md) – maintainer workflow notes
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) – privacy and security behavior (factual)
- [SCREENSHOTS.md](SCREENSHOTS.md) – screenshot / collage notes
- [ENHANCEMENT_PROPOSALS.md](ENHANCEMENT_PROPOSALS.md) – optional future ideas (not a roadmap commitment)

## Related project docs (repository root / `.github`)

- [../README.md](../README.md) – product overview and install summary
- [../INSTALL.md](../INSTALL.md) – detailed installation
- [../CHANGELOG.md](../CHANGELOG.md) – release history
- [../CONTRIBUTING.md](../CONTRIBUTING.md) – contribution guide
- [../.github/SECURITY.md](../.github/SECURITY.md) – vulnerability reporting and supported versions
- [../.github/SUPPORT.md](../.github/SUPPORT.md) – user support

## Tools

Helper scripts live under [`../tools/`](../tools/) (build, validate, collage, release helpers). There is no separate `tools/README.md`; inspect the scripts and [MAINTENANCE.md](MAINTENANCE.md) for usage.

## Packaging & Validation

- Build artifacts: `make dist` → flat zip + source zip in `dist/`
- Validation: `make release-validate` / `tools/validate_release_zip.sh`
- CI: see `.github/workflows/` for lint, release-validate, CodeQL, and publish jobs

If you add new internal documentation, keep it under `docs/` so the project root stays tidy.
