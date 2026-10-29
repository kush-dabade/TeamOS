# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1 — Build the static SPA
# -----------------------------------------------------------------------------

FROM node:22-slim AS builder

WORKDIR /usr/src/app

# Copy dependency manifests first to maximize Docker layer caching.
COPY package*.json ./

RUN npm ci

COPY . .

# The public origin the SPA calls (REST, Better Auth, Socket.IO) - inlined
# into the bundle by Vite at build time, so it has to be a build argument.
# It is a public URL, not a secret. src/lib/env.ts only throws at runtime in
# the browser, so fail the build here instead of shipping a bundle that
# crashes on load.
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build argument is required" >&2 && exit 1)
ENV VITE_API_URL=${VITE_API_URL}

# `build` is `tsc -b && vite build` - typecheck and production bundle.
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — Caddy: TLS termination, static files, reverse proxy
# -----------------------------------------------------------------------------

FROM caddy:2.10-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /usr/src/app/dist /srv

# Release metadata - same contract as backend/Dockerfile. These replace the
# caddy base image's own title/source/revision labels, which describe Caddy,
# not this image. teamos.public-origin records the origin baked into the
# bundle: scripts/ops/deploy.sh refuses an image built for a different
# PUBLIC_ORIGIN than the host it is deploying to.
ARG VITE_API_URL
ARG APP_REVISION=""
ARG IMAGE_SOURCE=""
ARG IMAGE_CREATED=""
LABEL org.opencontainers.image.title="TeamOS web" \
      org.opencontainers.image.description="TeamOS single-page app behind Caddy (TLS, static files, reverse proxy)" \
      org.opencontainers.image.source="${IMAGE_SOURCE}" \
      org.opencontainers.image.revision="${APP_REVISION}" \
      org.opencontainers.image.created="${IMAGE_CREATED}" \
      org.opencontainers.image.version="" \
      teamos.public-origin="${VITE_API_URL}"
