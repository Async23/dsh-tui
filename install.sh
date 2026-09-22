#!/bin/sh
# Install Async23/dsh-tui from its GitHub Release. The downloaded installer
# pins its release version and verifies the plugin tarball before installation.
set -eu
command -v node >/dev/null 2>&1 || { echo 'Node.js is required.' >&2; exit 1; }
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
curl -fsSL https://github.com/Async23/dsh-tui/releases/latest/download/install.mjs -o "$stage/install.mjs"
node "$stage/install.mjs" "$@"
