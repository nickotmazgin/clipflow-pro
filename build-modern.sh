#!/bin/bash

# ClipFlow Pro - Build Script (GNOME 45-50)
# Compatibility wrapper around build.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "${SCRIPT_DIR}/build.sh"

