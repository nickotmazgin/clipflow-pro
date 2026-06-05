# Screenshot files

| Path | Use |
|------|-----|
| `screenshots/collage-v1.4.2-2026.jpg` | Main README collage (HD JPEG, 8-tile grid; About Maintenance last) |
| `screenshots/v1.4.2/1c.jpg` | History window — multi-select, context menu |
| `screenshots/v1.4.2/2c.jpg` | Panel recent clips / shortcuts |
| `screenshots/v1.4.2/3.jpg` | Settings → Behavior (unchanged from v1.4.1) |
| `screenshots/v1.4.2/3c.jpg` | Settings → Shortcuts |
| `screenshots/v1.4.2/4c.jpg` | About → Maintenance reset |

Source PNGs and JPEG exports live in `~/Pictures/Screenshots/clipflow pro 2026/` (grid inputs under `collage-grid/`).

Rebuild collage:

```bash
python3 tools/make_collage_2026.py clipflow \
  "$HOME/Pictures/Screenshots/clipflow pro 2026/collage-grid" \
  /tmp/clipflow-collage.png
# then export JPEG with quality 93 (see tools/rebuild_all_collages.sh)
```

The README shows the collage plus five highlight JPGs in a table.
