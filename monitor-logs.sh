#!/bin/bash
# Monitor ClipFlow Pro extension logs in real-time

echo "=== ClipFlow Pro Log Monitor ==="
echo "Press Ctrl+C to stop"
echo ""
journalctl --user -f | grep --line-buffered -i "clipflow"













