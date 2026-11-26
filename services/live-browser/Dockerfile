# syntax=docker/dockerfile:1
# VCFO Live Browser — the broker image for ECS Fargate (infra/live-browser.tf).
# Build from the REPOSITORY ROOT, because the broker bundles the VCFO Assist engine from
# extensions/vcfo-assist/src and the Suite contract from src/lib/live-browser/contract.ts:
#
#   docker build -f services/live-browser/Dockerfile -t vcfo-suite-live-browser .
#   docker run -p 8091:8091 -e LIVE_BROWSER_SHARED_SECRET=… -e SUITE_URL=https://app.sbctrack.in vcfo-suite-live-browser
#
# The Playwright image carries Node and the Chromium build that matches playwright 1.62.1.

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS build
WORKDIR /srv
COPY services/live-browser/package.json services/live-browser/package-lock.json services/live-browser/
# A build behind a TLS-inspecting proxy passes its CA as a secret: --secret id=ca,src=<bundle>.
RUN --mount=type=secret,id=ca,required=false cd services/live-browser && \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi && npm ci --ignore-scripts
COPY src/lib/live-browser/contract.ts src/lib/live-browser/contract.ts
COPY extensions/vcfo-assist/package.json extensions/vcfo-assist/package.json
COPY extensions/vcfo-assist/src extensions/vcfo-assist/src
COPY services/live-browser services/live-browser
RUN cd services/live-browser && node build.mjs && npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner
WORKDIR /srv/services/live-browser
ENV NODE_ENV=production \
    PORT=8091 \
    LIVE_BROWSER_MOCK_DIR=/srv/mock-portal
COPY --from=build --chown=pwuser:pwuser /srv/services/live-browser/dist ./dist
COPY --from=build --chown=pwuser:pwuser /srv/services/live-browser/node_modules ./node_modules
COPY --from=build --chown=pwuser:pwuser /srv/services/live-browser/package.json ./package.json
# The mock portal, served on 127.0.0.1 inside the task only when LIVE_BROWSER_MOCK_PORT is set.
COPY --chown=pwuser:pwuser extensions/vcfo-assist/mock-portal /srv/mock-portal
USER pwuser
EXPOSE 8091
CMD ["node", "dist/server.mjs"]
