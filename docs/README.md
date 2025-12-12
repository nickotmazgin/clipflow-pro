# Developer Documentation Index

This directory collects the internal notes, audits, and helper material that were previously stored in the project root.  
It is not required for end users of the extension but provides useful history for development and maintenance.

- `archive/notes/` – assorted research briefs, compatibility audits, and workflow checklists.
- `archive/legacy-extension-samples/` – historic snapshots of experimental `extension.js` and `metadata.json` variants.
- `../tools/` – helper scripts for development and automation (see `tools/README.md`).

## Packaging & Validation

- Build artifacts: `make dist` → creates flat zip + source zip in `dist/`
- Validation: use local linters/CI workflows to verify JSON/XML and build integrity
- CI: see `.github/workflows/` for static analysis and lint jobs

If you add new internal documentation, please keep it under `docs/` so the project root stays tidy.
