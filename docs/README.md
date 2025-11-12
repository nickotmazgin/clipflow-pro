# Developer Documentation Index

This directory collects the internal notes, audits, and helper material that were previously stored in the project root.  
It is not required for end users of the extension but provides useful history for development and maintenance.

- `archive/notes/` – assorted research briefs, compatibility audits, and workflow checklists.
- `archive/legacy-extension-samples/` – historic snapshots of experimental `extension.js` and `metadata.json` variants.
- `../tools/` – helper scripts for development and automation (see `tools/README.md`).

## Packaging & Validation (GNOME 45+)

- Build artifacts: `make dist` → creates flat EGO zip + source zip in `dist/`
- Validate before upload: `make ego-validate` → checks flat layout, required files, metadata/schema sanity, and ESM constructor `super(metadata)`
- CI: see `.github/workflows/ego-validate.yml` (runs on PRs and `main`)

If you add new internal documentation, please keep it under `docs/` so the project root stays tidy.
