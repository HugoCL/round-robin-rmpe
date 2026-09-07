# syntax=docker/dockerfile:1

# Image for the Next.js app (La Lista). The Convex backend is a separate
# prebuilt image — see docker-compose.yml.

ARG NODE_VERSION=26-alpine

# ---------------------------------------------------------------- base
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------- deps
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY chrome-extension/package.json ./chrome-extension/package.json
# Next's standalone output tracer cannot follow pnpm's symlinked virtual store
# and silently omits transitive deps (@swc/helpers), so the container crashes
# with MODULE_NOT_FOUND on boot. A flat node_modules avoids it. Image-only —
# the committed pnpm-workspace.yaml and local dev are untouched.
RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
	pnpm install --frozen-lockfile

# ---------------------------------------------------------------- tools
# Source + node_modules, no build. Used by the `convex-deploy` compose
# service to push functions and set backend env vars without needing
# Node installed on the host.
FROM deps AS tools
COPY . .
CMD ["pnpm", "exec", "convex", "deploy"]

# ---------------------------------------------------------------- builder
FROM deps AS builder

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they must be present here rather than only at runtime.
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL \
	NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
	NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
	NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
	NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
	NEXT_OUTPUT_STANDALONE=1 \
	NEXT_TELEMETRY_DISABLED=1

RUN test -n "$NEXT_PUBLIC_CONVEX_URL" \
	|| (echo "ERROR: NEXT_PUBLIC_CONVEX_URL build arg is required" >&2 && exit 1)

COPY . .
RUN pnpm run build

# ---------------------------------------------------------------- runner
FROM base AS runner
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
