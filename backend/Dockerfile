# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1 — Build
# -----------------------------------------------------------------------------

FROM node:22-slim AS builder

# prisma.config.ts only requires DATABASE_URL to be present/non-empty for
# `prisma generate` (it never connects to the database at generate time).
# This dummy value satisfies that check without ever exposing the real
# Postgres credential to the build - the production DATABASE_URL is
# injected at container runtime via Docker Compose `environment:`, never
# as a build arg, so it never lands in an image layer.
ARG DATABASE_URL=postgresql://user:password@localhost:5432/db
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /usr/src/app

# Copy dependency manifests first to maximize Docker layer caching.
COPY package*.json ./

# Install all dependencies required for building the application.
RUN npm ci

# Copy the application source.
COPY . .

# Generate the Prisma Client, compile the application, and remove
# development dependencies.
RUN npx prisma generate \
    && npm run build \
    && npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 2 — Production Runtime
# -----------------------------------------------------------------------------

FROM node:22-slim AS runtime

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy the production application from the builder image, owned by the
# runtime user as it is written. A `chown -R` afterwards would copy every
# file into a second layer (node_modules alone is ~430 MB).
COPY --from=builder --chown=node:node /usr/src/app/package.json ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist
COPY --from=builder --chown=node:node /usr/src/app/prisma ./prisma
# Prisma 7 sources datasource.url from this config file rather than
# schema.prisma directly - required at runtime for `prisma migrate deploy`
# (run by the `migrate` service), not just at build time for `prisma generate`.
COPY --from=builder --chown=node:node /usr/src/app/prisma.config.ts ./
# prisma.config.ts imports this directly (as TS source, not through dist/)
# to build DATABASE_URL - same reason as the line above: the migrate
# service invokes the Prisma CLI against prisma.config.ts itself at
# runtime, so its one dependency needs to exist alongside it here too.
COPY --from=builder --chown=node:node /usr/src/app/src/config/database.config.ts ./src/config/database.config.ts

# Create the uploads directory. Only the two directories themselves need a
# new owner; everything copied above already belongs to node.
RUN mkdir -p uploads \
    && chown node:node /usr/src/app /usr/src/app/uploads

# Run the application as the non-root Node.js user.
USER node

EXPOSE 3000

# Release metadata, last so a new commit only changes these metadata layers.
# The Release workflow passes all three; a local build leaves them empty and
# the image reports no revision (src/config/release.config.ts).
# scripts/ops/deploy.sh refuses an image whose revision label isn't the
# commit it was asked to deploy.
ARG APP_REVISION=""
ARG IMAGE_SOURCE=""
ARG IMAGE_CREATED=""
LABEL org.opencontainers.image.title="TeamOS backend" \
      org.opencontainers.image.description="TeamOS API, BullMQ worker and migration runner" \
      org.opencontainers.image.source="${IMAGE_SOURCE}" \
      org.opencontainers.image.revision="${APP_REVISION}" \
      org.opencontainers.image.created="${IMAGE_CREATED}"
ENV APP_REVISION=${APP_REVISION}

CMD ["node", "dist/src/server.js"]