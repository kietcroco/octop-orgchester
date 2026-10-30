#!/usr/bin/env bash
# Run dashboard unit tests against the overlay (patches + new files applied),
# without touching octop/dashboard on disk. Needs Docker only.
#
#   bash octop-orchester/scripts/dashboard_test.sh [vitest args...]
#   bash octop-orchester/scripts/dashboard_test.sh --tsc      # type-check instead of vitest
#   bash octop-orchester/scripts/dashboard_test.sh --lint [paths]   # eslint + prettier --check
set -euo pipefail
cd "$(dirname "$0")/../.."
# Git Bash gives /d/... paths; Docker Desktop needs drive-letter paths.
ROOT="$(pwd -W 2>/dev/null || pwd)"

docker run --rm \
  -v "$ROOT:/src:ro" \
  -v octop-dashboard-npm:/root/.npm \
  node:20-slim bash -c '
    set -eu
    apt-get update >/dev/null && apt-get install -y --no-install-recommends git >/dev/null
    cp -r /src/octop /work && rm -f /work/.git && cd /work && git init -q
    cp -r /src/octop-orchester/src/dashboard/. dashboard/
    for p in $(find /src/octop-orchester/patches/dashboard-pkg -name "*.patch" | sort); do
      git apply --whitespace=nowarn "$p"
    done
    for p in $(find /src/octop-orchester/patches/dashboard -name "*.patch" | sort); do
      git apply --whitespace=nowarn "$p"
    done
    cd dashboard
    npm ci --no-audit --no-fund >/dev/null
    if [ "${1:-}" = "--tsc" ]; then exec npx tsc -b; fi
    if [ "${1:-}" = "--lint" ]; then
      shift
      # Paths default to the Flows overlay; pass others to check them instead.
      [ "$#" -gt 0 ] || set -- src/pages/Flows src/api/modules/flows.ts src/api/modules/flows.test.ts
      npx eslint "$@" && exec npx prettier --check --end-of-line auto "$@"
    fi
    exec npx vitest run "$@"
  ' bash "$@"
