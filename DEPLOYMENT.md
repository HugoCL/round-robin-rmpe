# Deploying La Lista

Two supported targets:

| Target | Web app | Backend | Database |
| --- | --- | --- | --- |
| **Vercel + Convex Cloud** (current) | Vercel | Convex Cloud | managed by Convex |
| **Self-hosted** | Docker | `convex-backend` container | your Postgres |

Both run the *same* application code. Self-hosting swaps where the Convex
backend runs; it does not change a single line of `convex/`, and the live-update
behaviour is identical because it is the same backend binary.

---

## Self-hosted quick start

Requirements on the host: **Docker with Compose v2**. Nothing else — Node,
pnpm and the Convex CLI all run inside the images.

```bash
cp .env.selfhost.example .env
```

Fill in the three Clerk values (everything else has a working default or is
generated for you):

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk dashboard → API keys
- `CLERK_JWT_ISSUER_DOMAIN` — Clerk dashboard → JWT Templates → the template named exactly `convex` → Issuer

Then:

```bash
./scripts/selfhost.sh bootstrap
```

That generates the Postgres password and Convex instance secret, starts
Postgres and the Convex backend, mints an admin key, pushes the backend
environment variables, deploys everything in `convex/` (schema, indexes, crons,
HTTP actions), then builds and starts the web app on <http://localhost:3000>.

### Day-to-day

```bash
./scripts/selfhost.sh deploy      # after changing convex/ or app code
./scripts/selfhost.sh push-env    # after editing backend env vars in .env
./scripts/selfhost.sh dashboard   # Convex admin UI on :6791
./scripts/selfhost.sh logs web    # tail a service
./scripts/selfhost.sh down        # stop (volumes are kept)
```

---

## What runs where

```
browser ──▶ web            :3000   Next.js (standalone build)
        └─▶ convex-backend :3210   queries · mutations · actions · websocket
            convex-backend :3211   HTTP actions (POST /flash-assign)
                    │
                    └──▶ postgres  :5432   every table in convex/schema.ts
```

`convex-dashboard` (`:6791`) and `convex-deploy` sit behind Compose profiles, so
they do not run as part of the normal stack.

The Convex backend image is the same code as Convex Cloud, so the features this
app leans on all work self-hosted:

- **Reactive queries** — the websocket push behind every live update
- **Crons** (`convex/crons.ts`) — event notifications, absence returns, birthdays, nightly cleanup
- **HTTP actions** (`convex/http.ts`) — the Chrome extension's `/flash-assign`
- **Node actions** (`convex/pushActions.ts`, `"use node"`) — web-push, which needs the Node runtime rather than the V8 one
- **Components** — `@convex-dev/migrations`

## Behind a domain

Put a reverse proxy in front and set the public origins in `.env`. These values
are baked into the client bundle and used for action callbacks, so they must be
what the *browser* sees, not internal container names:

```sh
CONVEX_CLOUD_ORIGIN=https://convex.example.com        # -> backend :3210
CONVEX_SITE_ORIGIN=https://convex-http.example.com    # -> backend :3211
```

Terminate TLS at the proxy and make sure it passes WebSocket upgrade headers
through to `:3210` — without that, queries load once and then never update.

Re-run `./scripts/selfhost.sh deploy` after changing either origin: the web
image inlines `CONVEX_CLOUD_ORIGIN` at build time.

## Managed Postgres

To use Neon/RDS/Cloud SQL instead of the bundled container, drop the `postgres`
service and point the backend at your instance:

```sh
# Connection string WITHOUT the database name — the backend appends it.
POSTGRES_URL=postgresql://user:password@host:5432
DO_NOT_REQUIRE_SSL=      # leave empty so TLS is required
```

Create the database first — the name is derived from the Convex instance name
and must be exactly `convex_self_hosted`:

```bash
psql "$POSTGRES_URL/postgres" -c "CREATE DATABASE convex_self_hosted"
```

Run the backend in the same region as the database. Latency between the two is
on the path of every query.

## Backups

Convex owns the schema inside Postgres, so back up through Convex rather than
with `pg_dump` alone:

```bash
docker compose --profile setup run --rm convex-deploy \
  pnpm exec convex export --path /backups/snapshot.zip
```

The snapshot lands in `./backups/` on the host.

`CONVEX_INSTANCE_SECRET` in `.env` is what makes admin keys reproducible. Keep
it with your backups — losing it means existing admin keys stop working.

## Chrome extension

The extension talks to Convex directly, so a self-hosted build needs its own
endpoints. Create `chrome-extension/.env`:

```sh
VITE_CONVEX_URL=https://convex.example.com
VITE_CONVEX_SITE_URL=https://convex-http.example.com
VITE_SYNC_HOST=https://lalista.example.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

```bash
pnpm run ext:build     # or ext:pack for a distributable .zip
```

The build rewrites `host_permissions` in the emitted manifest to match; MV3
blocks requests to origins that are not listed. With no `.env` present the build
is byte-identical to the currently shipped extension.

---

## Still external

Self-hosting removes the Convex Cloud dependency. It does not remove:

- **Clerk** — authentication, SaaS only. Both the web app and the Convex backend validate its JWTs.
- **Google Chat webhooks** — per-team, configured in the app; only needed for chat notifications.
- **Google Generative AI** — optional, only for AI-drafted chat messages. Unset = feature off.
- **Unsplash** — optional landing-page imagery.

Web push needs VAPID keys, which you generate yourself:

```bash
npx web-push generate-vapid-keys
```

Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in
`VAPID_PRIVATE_KEY`, then `./scripts/selfhost.sh push-env`.

---

## Notes

- `.env` is read by Docker Compose. On a machine that also runs `pnpm run dev`,
  Next.js reads it too — `.env.local` still takes precedence.
- The web image builds Next.js in `standalone` mode, gated behind
  `NEXT_OUTPUT_STANDALONE=1` so Vercel builds are unaffected.
- The image installs with a flat `node_modules` (`nodeLinker: hoisted`). Next's
  standalone tracer cannot follow pnpm's symlinked store and drops transitive
  dependencies, which crashes the container on boot. This applies to the image
  only; local development keeps the normal pnpm layout.
- Deploying to Vercel is unchanged: `scripts/vercel-build.mjs` still runs
  `convex deploy --cmd "npm run build"` against Convex Cloud.
