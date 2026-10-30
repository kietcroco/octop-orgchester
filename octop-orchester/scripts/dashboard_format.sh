#!/usr/bin/env bash
# Format overlay dashboard files with the same Prettier octop pins (3.0.0, default
# config), writing the result back into octop-orchester/src/dashboard. Needs Docker.
# Line endings are kept as they are (`--end-of-line auto`), so CRLF files stay CRLF.
#
#   bash octop-orchester/scripts/dashboard_format.sh [paths relative to dashboard/]
#
# With no paths it formats the Flows feature. Check the result with
#   bash octop-orchester/scripts/dashboard_test.sh --lint
set -euo pipefail
cd "$(dirname "$0")/../.."
# Git Bash gives /d/... paths; Docker Desktop needs drive-letter paths.
ROOT="$(pwd -W 2>/dev/null || pwd)"

[ "$#" -gt 0 ] || set -- src/pages/Flows src/api/modules/flows.ts src/api/modules/flows.test.ts

docker run --rm \
  -v "$ROOT/octop-orchester/src/dashboard:/overlay" \
  -v octop-dashboard-npm:/root/.npm \
  node:20-slim bash -c '
    set -eu
    mkdir -p /tmp/fmt && cd /tmp/fmt
    npm init -y >/dev/null
    npm install --no-audit --no-fund prettier@3.0.0 >/dev/null
    cd /overlay
    exec /tmp/fmt/node_modules/.bin/prettier --write --end-of-line auto "$@"
  ' bash "$@"
