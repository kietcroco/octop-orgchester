# syntax=docker/dockerfile:1
# =============================================================================
# Octop-Orchester — multi-stage Docker build
#
# Source is copied from the `octop/` submodule (build context = repo root).
# Mirrors octop/docker/Dockerfile; customizations go here, not in the submodule.
#
# Build (from repo root):
#   docker build -f octop-orchester/Dockerfile -t octop-orchester:latest .
#
# Or via Compose (from octop-orchester/):
#   docker compose up -d --build
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — frontend build
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

ARG NPM_REGISTRY=
ARG NODE_MAX_OLD_SPACE_SIZE=2048
WORKDIR /build/dashboard

COPY octop/dashboard/package.json octop/dashboard/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    set -eu; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm ci --no-audit \
    || { echo "npm ci failed — retrying clean"; rm -rf node_modules; npm ci --no-audit; }; \
    test -x node_modules/.bin/vite

COPY octop/dashboard/ ./

RUN mkdir -p ../src/octop/dashboard

RUN NODE_ENV=production NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}" npm run build:docker


# ---------------------------------------------------------------------------
# Stage 2 — Python runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

LABEL maintainer="OrcaKit Team"
LABEL org.opencontainers.image.title="Octop-Orchester"
LABEL org.opencontainers.image.description="Octop customized with Orchester features."
LABEL org.opencontainers.image.source="https://github.com/TencentCloud/Octop"
LABEL org.opencontainers.image.licenses="MIT"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/data \
    OCTOP_BIND_HOST=0.0.0.0 \
    OCTOP_PORT=8088 \
    OCTOP_LOG_LEVEL=info \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

ARG PIP_INDEX_URL=
ARG PIP_TRUSTED_HOST=
ARG APT_MIRROR=

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    if [ -n "$APT_MIRROR" ]; then \
        printf 'Types: deb\nURIs: https://%s/debian\nSuites: trixie trixie-updates\nComponents: main contrib non-free non-free-firmware\n\nTypes: deb\nURIs: https://%s/debian-security\nSuites: trixie-security\nComponents: main contrib non-free non-free-firmware\n' \
            "$APT_MIRROR" "$APT_MIRROR" > /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libffi-dev \
        libgl1 \
        libglib2.0-0 \
        curl \
        git \
        ripgrep \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.7 /uv /uvx /bin/

WORKDIR /app

# Install locked dependencies first so source-only changes reuse this layer
COPY octop/pyproject.toml octop/uv.lock octop/README.md octop/LICENSE ./
RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -n "$PIP_INDEX_URL" ]; then \
        export UV_INDEX_URL="$PIP_INDEX_URL"; \
        if [ -n "$PIP_TRUSTED_HOST" ]; then export UV_INSECURE_HOST="$PIP_TRUSTED_HOST"; fi; \
    fi \
    && uv sync --frozen --no-install-project --no-dev \
        --extra browser --extra local-embedding --extra knowledge-ocr

ENV PATH="/app/.venv/bin:$PATH" \
    PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

COPY octop/src/ ./src/
COPY --from=frontend-builder /build/src/octop/dashboard/ ./src/octop/dashboard/

COPY octop/.env.example ./
COPY octop/docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -n "$PIP_INDEX_URL" ]; then \
        export UV_INDEX_URL="$PIP_INDEX_URL"; \
        if [ -n "$PIP_TRUSTED_HOST" ]; then export UV_INSECURE_HOST="$PIP_TRUSTED_HOST"; fi; \
    fi \
    && uv sync --frozen --no-dev \
        --extra browser --extra local-embedding --extra knowledge-ocr \
    && .venv/bin/python -c "import cv2, fastembed, huggingface_hub, rapidocr, onnxruntime, pymupdf" \
    && apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && apt-get purge -y --auto-remove build-essential \
    && rm -rf /var/lib/apt/lists/* /tmp/*

RUN mkdir -p /data/.octop

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD ["sh", "-c", "curl -f http://localhost:${OCTOP_PORT:-8088}/api/health || exit 1"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD []
