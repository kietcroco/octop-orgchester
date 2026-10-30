# syntax=docker/dockerfile:1
# =============================================================================
# Octop-Orchester — customization layer on top of a locally-built Octop image
#
# The base is NOT duplicated here: it is built by `octop/docker/Dockerfile`
# from the checked-out submodule, then this file inherits it (see
# docker-compose.yml — the base arrives as a buildx named context, so it is
# rebuilt from source instead of being pulled from a registry).
#
# Only the dashboard is rebuilt: the backend customization is a set of patches
# plus a locale file, but the published bundle ships antd/dayjs for zh+en only,
# so the vi locale cannot be added without a Vite build.
#
# Build (from octop-orchester/, gets ordering for free):
#   docker compose up -d
#
# Build by hand (base image must exist first):
#   docker build -f octop/docker/Dockerfile -t octop-base:local octop
#   docker build -f octop-orchester/Dockerfile -t octop-orchester:latest .
# =============================================================================
ARG OCTOP_BASE=octop-base:local

# ---------------------------------------------------------------------------
# Stage 1 — dashboard build
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

ARG NPM_REGISTRY=
ARG NODE_MAX_OLD_SPACE_SIZE=2048
WORKDIR /build/dashboard

# git is needed to apply patches; the slim image does not ship it
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY octop/dashboard/package.json octop/dashboard/package-lock.json ./

# Dependency patches must land BEFORE `npm ci`: a patch that adds a package
# would otherwise be invisible to the install, and the build would fail at
# import time. Everything else stays in patches/dashboard/ (applied later).
# Patch paths are octop-root-relative (dashboard/...), so apply from /build —
# the same convention the later source patches use.
COPY octop-orchester/patches/dashboard-pkg/ /tmp/patches-pkg/
RUN set -eu; \
    cd /build; \
    if [ -d /tmp/patches-pkg ]; then \
      for p in $(find /tmp/patches-pkg -name '*.patch' | sort); do \
        echo "applying $p"; \
        git apply --whitespace=nowarn "$p" || { echo "FAILED: $p"; exit 1; }; \
      done; \
    fi; \
    rm -rf /tmp/patches-pkg

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    set -eu; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm ci --no-audit \
    || { echo "npm ci failed — retrying clean"; rm -rf node_modules; npm ci --no-audit; }; \
    test -x node_modules/.bin/vite

COPY octop/dashboard/ ./

# New frontend files (src/ mirrors octop's tree) — copied before patching
COPY octop-orchester/src/dashboard/ ./

# Apply every frontend patch. Patch paths are octop-root-relative
# (dashboard/src/...), so apply from /build.
COPY octop-orchester/patches/ /tmp/patches/
WORKDIR /build
RUN set -eu; \
    for p in $(find /tmp/patches/dashboard -name '*.patch' | sort); do \
      echo "applying $p"; \
      git apply --whitespace=nowarn "$p" || { echo "FAILED: $p"; exit 1; }; \
    done; \
    rm -rf /tmp/patches

WORKDIR /build/dashboard

RUN mkdir -p ../src/octop/dashboard

RUN NODE_ENV=production NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}" npm run build:docker


# ---------------------------------------------------------------------------
# Stage 2 — base runtime + customization
# ---------------------------------------------------------------------------
FROM ${OCTOP_BASE}

LABEL org.opencontainers.image.title="Octop-Orchester" \
      org.opencontainers.image.description="Octop built from source with the Orchester customization layer (Vietnamese locale)." \
      org.opencontainers.image.licenses="MIT"

# New backend files (src/ mirrors octop's tree)
COPY octop-orchester/src/src/ /app/src/

# Apply every backend patch from the app root (octop-root-relative paths).
# The base installs octop in editable mode (.pth -> /app/src), so patched
# sources take effect without reinstalling.
COPY octop-orchester/patches/ /tmp/patches/
RUN set -eu; \
    cd /app; \
    for p in $(find /tmp/patches/src -name '*.patch' | sort); do \
      echo "applying $p"; \
      git apply --whitespace=nowarn "$p" || { echo "FAILED: $p"; exit 1; }; \
    done; \
    rm -rf /tmp/patches

# Replace the base's bundle. COPY merges directories, so the base's stale
# hashed chunks are removed first instead of lingering.
RUN rm -rf /app/src/octop/dashboard
COPY --from=frontend-builder /build/src/octop/dashboard/ /app/src/octop/dashboard/

# The venv is a named volume in compose, so it outlives the container. Docker
# seeds it from this image the first time and then never touches it again, so a
# rebuilt image would otherwise run new code against a stale venv. Stamp the
# build inputs here; the entrypoint syncs only when the stamp no longer matches.
RUN cat /app/uv.lock /app/pyproject.toml | sha256sum | cut -d' ' -f1 > /app/.venv/.image-stamp

COPY octop-orchester/docker/octop-entrypoint.sh /usr/local/bin/octop-entrypoint.sh
RUN chmod +x /usr/local/bin/octop-entrypoint.sh

ENTRYPOINT ["octop-entrypoint.sh"]
