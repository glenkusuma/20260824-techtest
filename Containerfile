FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json* ./
COPY services/backend/package.json services/backend/package.json
COPY services/frontend/package.json services/frontend/package.json
COPY services/telemetry-simulator/package.json services/telemetry-simulator/package.json
COPY services/automation/package.json services/automation/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM builder AS backend
# The backend writes its SQLite DB only to DATABASE_PATH (/data/application.db),
# which compose bind-mounts from a pre-created host dir so UID 1000 can write it
# (the node user drops root; no root bootstrap). Code lives read-only in /app.
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/application.db CORS_ORIGIN=http://localhost:5173 RATE_LIMIT_MAX=10000
EXPOSE 3000
USER node
CMD ["node", "services/backend/dist/server.js"]

FROM builder AS frontend
# Static preview server: no persistent writes, so it can run unprivileged.
# vite bundles vite.config.ts on the fly and writes a temp bundle into the service's
# node_modules/.vite-temp; that tree was built as root, so hand the frontend subtree
# to the node user (UID 1000) or the preview crashes with EACCES. Still no root daemon.
RUN chown -R node:node /app/services/frontend
ENV NODE_ENV=production
EXPOSE 5173
USER node
CMD ["npm", "run", "preview", "-w", "@technical-test/frontend", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM builder AS telemetry-simulator
# Publishes segments to the backend over HTTP; keeps no local state.
ENV NODE_ENV=production BACKEND_URL=http://backend:3000 SIMULATOR_CADENCE_MS=300000
USER node
CMD ["node", "services/telemetry-simulator/dist/service.js"]

FROM builder AS automation
USER root
# Rootless automation: cronie requires a root daemon and cannot run as UID 1000.
# Use supercronic, a single static binary built to run crontabs as any user.
# the ENTIRE container (daemon + collector + cleanup) runs as UID 1000.
# Build-time root is only used to install packages and drop privileges ("USER node").
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && SUPERCRONIC_VERSION=0.2.49 \
  && curl -fsSL -o /tmp/supercronic "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
  && echo "a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1  /tmp/supercronic" | sha256sum -c - \
  && install -m 0755 /tmp/supercronic /usr/local/bin/supercronic \
  && rm -f /tmp/supercronic \
  && mkdir -p /var/log && touch /var/log/cron.log \
  && chown node:node /var/log/cron.log \
  && chown node:node /app/services/automation/crontab \
  && chmod 0644 /app/services/automation/crontab
ENV NODE_ENV=production BACKEND_URL=http://backend:3000 COLLECTOR_DATABASE_PATH=/data/collector.db ARTIFACT_DIR=/home/cron COLLECTION_SOURCE_NAME=backend-telemetry TZ=Asia/Jakarta
USER node
ENTRYPOINT ["bash", "services/automation/scripts/entrypoint.sh"]
