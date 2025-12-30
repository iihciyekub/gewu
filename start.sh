#!/bin/sh

# Backward-compatible wrapper (preferred: `node start.js`)
exec node "$(dirname "$0")/start.js"
