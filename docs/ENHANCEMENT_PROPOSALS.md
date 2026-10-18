# ClipFlow Pro - Enhancement Proposals

Status of the original proposal list as of **v1.5.7** (GNOME Shell 45–51), split into what has shipped and what is still open.

## Shipped

| Proposal | Where it lives |
|----------|----------------|
| Search (with live filtering) | History window search entry (`tools/history-window/history-window.js`) |
| Cached filtered/sorted results | `_invalidateFilterCache()` / `_filterCacheValid` in `extension.js` |
| Paging for large histories | `entries-per-page` and `classic-max-rows` settings |
| Smart content detection | `_detectContentType()` in `extension.js` |
| Export / import history | Panel actions; files are written owner-only (0600) to the `io-folder` setting |
| Pin / star with filters | Panel filters plus `classic-filter-*` shortcuts |
| Quick copy and paste shortcuts | `enhanced-copy-shortcut`, `paste-latest-insert-shortcut`, `paste-previous-shortcut` and others |
| Configuration validation | `_safeGet*()` helpers clamp and default every setting read |
| Privacy mode | Timed pause (`pause-duration-minutes`), `pause-on-lock`, `clear-on-lock`, `clear-on-logout` |
| Sensitive content handling | `ignore-passwords`, `auto-clear-sensitive`, `ignore-apps` |
| Copy notifications | `show-copy-notifications`, `show-copied-preview` |

## Backlog

| Priority | Proposal | Notes |
|----------|----------|-------|
| Medium | Arrow-key navigation between panel rows | Panel rows handle Enter / Space today; the history window list already supports arrow keys |
| Medium | Highlight search matches | History window search filters, but does not mark the match |
| Medium | Age-based history expiry | Only `max-entries` and sensitive auto-clear exist today |
| Medium | Virtualized list for very large histories | Paging covers the common case |
| Low | Category icons per content type | `contentType` is already detected; only the UI is missing |
| Low | Drag and drop out of the history window | |

## Not planned for now

| Proposal | Reason |
|----------|--------|
| Encryption at rest | Needs key management (keyring integration) for real benefit; history is already owner-only (0600) |
| Cloud sync | Out of scope for a local, privacy-first clipboard tool |
| Rich text / image history | Large change to storage format and UI |
| Multiple named clipboards | Low demand relative to cost |

## Testing

Before tagging a release, follow the regression checks in [MAINTENANCE.md](MAINTENANCE.md#clipboard-and-insertion-regression-checks) and the release checklist issue template.
