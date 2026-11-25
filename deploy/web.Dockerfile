# Static front ends served by Caddy, which also proxies /api to the API container (ADR-0023):
#   /         landing page (deploy/landing)
#   /admin/   office and field application (apps/web)
#   /ukazka/  demo with fictitious data running in the visitor's browser (apps/web demo build)
#   /spike/   QR spike PWA (apps/spike-qr), for testing the scanner against this server
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
# Workspace dependency of the web app (only its demo build uses it, see ADR-0015).
COPY apps/api/package.json apps/api/
COPY apps/spike-qr/package.json apps/spike-qr/
COPY packages/shared/package.json packages/shared/
COPY packages/scanner/package.json packages/scanner/
RUN pnpm install --frozen-lockfile --filter @revize/web... --filter @revize/spike-qr...
COPY tsconfig.base.json ./
COPY packages packages
# The demo build runs the API in the browser and prebuilds its showcase database.
COPY apps/api apps/api
COPY apps/web apps/web
COPY apps/spike-qr apps/spike-qr
# The user guides are built into the app (Návody, apps/web/src/guides).
COPY docs docs
RUN BASE_PATH=/admin/ pnpm --filter @revize/web build \
 && BASE_PATH=/ukazka/ pnpm --filter @revize/web build:demo \
 && BASE_PATH=/spike/ pnpm --filter @revize/spike-qr build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/landing /srv/landing
COPY apps/api/assets/showcase/regal-ohnuty-stojan.jpg apps/api/assets/showcase/zebrik-praskla-pricka.jpg apps/api/assets/showcase/regal-chybi-pojistka.jpg apps/api/assets/showcase/vazak-poskozeny.jpg /srv/landing/img/
COPY --from=build /repo/apps/web/dist /srv/admin
COPY --from=build /repo/apps/web/dist-demo /srv/ukazka
COPY --from=build /repo/apps/spike-qr/dist /srv/spike
