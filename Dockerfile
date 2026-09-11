# VCFO Suite — production image for App Runner (or any container host).
# Same code as `npm run dev`; only env vars differ (see docs/context/AWS-DEPLOY.md).
#
#   docker build -t vcfo-suite .
#   docker run -p 3000:3000 --env-file .env.production vcfo-suite

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* is inlined at build time. Server-side links prefer the runtime
# SITE_URL env (src/lib/site-url.ts); the browser always uses its own origin.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_MAX_UPLOAD_MB=50
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MAX_UPLOAD_MB=$NEXT_PUBLIC_MAX_UPLOAD_MB \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# RDS certificates chain to Amazon's own CA. `pg` verifies the chain for
# sslmode=require, so Node must trust that bundle (certs/README.md).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    NODE_EXTRA_CA_CERTS=/app/certs/rds-global-bundle.pem
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/certs ./certs
# public/ holds the docx templates read via fs at request time.
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# App Runner (and other hosts) inject HOSTNAME=<instance name> at runtime,
# which the standalone server would bind to — the health check then never
# reaches port 3000. Force the wildcard bind at exec time, not via ENV.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
