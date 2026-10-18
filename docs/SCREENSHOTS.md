# Screenshot files

| Path | Use |
|------|-----|
| `screenshots/collage-v1.5.3.png` | Main README collage (history window, panel menus, settings) |
| `screenshots/v1.5.3/01..12-*.png` | README gallery: history window, panel menus, every settings tab |
| `screenshots/social-preview-v1.5.5.png` | GitHub social preview (1280×640) |

Screenshots, the collage, the social preview and the demo video are all made with
[`tools/media`](../tools/media/README.md):

```bash
python3 tools/media/clipflow_media.py screenshots   # screenshots/v<version>/ + collage
```

Older screenshot sets (v1.4.x) were removed from the tree; they remain in git history.
