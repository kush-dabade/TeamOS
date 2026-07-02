# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1 — Build
# -----------------------------------------------------------------------------

FROM node:22-slim AS builder

ARG DATABASE_URL
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

# Copy the production application from the builder image.
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Create the uploads directory.
RUN mkdir -p uploads \
    && chown -R node:node /usr/src/app

# Run the application as the non-root Node.js user.
USER node

EXPOSE 3000

CMD ["node", "dist/src/server.js"]