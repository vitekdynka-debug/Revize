# Static web front end served by Caddy, which also proxies /api to the API container.
# Until apps/web exists (M3) it serves the QR spike.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/spike-qr/package.json apps/spike-qr/
COPY packages/shared/package.json packages/shared/
COPY packages/scanner/package.json packages/scanner/
RUN pnpm install --frozen-lockfile --filter @revize/spike-qr...
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/spike-qr apps/spike-qr
RUN pnpm --filter @revize/spike-qr build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/spike-qr/dist /srv
