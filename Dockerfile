# syntax=docker/dockerfile:1

# ---- Build stage: compile frontend + backend ----
FROM node:22-bookworm AS build
WORKDIR /app

# Install all workspace deps (root + server + web) with the lockfile.
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install

# Build both workspaces.
COPY tsconfig.base.json ./
COPY server ./server
COPY web ./web
RUN npm run build

# Prune to production deps for the runtime image (keeps the correct sharp binary).
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    FOLDERS_DIR=/data/folders \
    IMAGES_DIR=/data/images \
    APP_DIR=/data/app \
    PORT=3000

# dcraw extracts RAW previews; poppler-utils (pdftoppm) renders PDF previews;
# libvips deps for sharp ship in its prebuilt binary.
RUN apt-get update \
    && apt-get install -y --no-install-recommends dcraw poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Production node_modules (incl. sharp built for this platform) and compiled output.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /data/folders /data/images /data/app
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
