#!/bin/sh
# Wrapper around the upstream entrypoint.
#
# Why: compose mounts a named volume at /app/.venv, so the interpreter lives
# outside the image and outlives it. Docker seeds that volume from the image
# once and never touches it again — so after rebuilding the image (new base,
# new lockfile) the container would run new code against a stale venv.
#
# The stamp file makes that check exact and offline: it is written from the
# build inputs at image build time, so the only thing that triggers a sync is
# those inputs actually changing. A boot with a matching stamp costs nothing,
# and a fresh volume (seeded from the same image) already matches.
set -e

cd /app

_stamp_now() {
    cat /app/uv.lock /app/pyproject.toml | sha256sum | cut -d' ' -f1
}

if [ "$(_stamp_now)" != "$(cat /app/.venv/.image-stamp 2>/dev/null || true)" ]; then
    echo "[entrypoint] venv does not match this image — syncing (UI-installed packages are kept)..."
    # --inexact: add/upgrade what the lockfile wants, never prune the extra
    # packages the user installed from the dashboard.
    if uv sync --frozen --no-dev --inexact \
            --extra browser --extra local-embedding --extra knowledge-ocr >/dev/null; then
        _stamp_now > /app/.venv/.image-stamp
    else
        echo "[entrypoint] venv sync failed — starting anyway; the environment may be stale." >&2
    fi
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
