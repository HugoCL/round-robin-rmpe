# La Lista

[![License: FSL-1.1-ALv2](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue)](LICENSE.md)
[![Demo](https://img.shields.io/badge/demo-vercel-black?logo=vercel)](https://round-robin-rmpe-demo.vercel.app/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Convex](https://img.shields.io/badge/backend-Convex-orange)](https://convex.dev)

Round-robin pull request reviewer assignment for engineering teams. Paste a PR
URL, hit assign, and La Lista picks the next reviewer, skips whoever is away, and
tells the team in Google Chat.

La Lista started inside a company team and is used daily to spread reviews
fairly. The interface is available in Spanish (default) and English.

[Live demo](https://round-robin-rmpe-demo.vercel.app/) (sign-in required) ·
[Self-hosting guide](DEPLOYMENT.md) · [Chrome extension](chrome-extension/README.md)

## What it does

**Assignment**

- Round-robin rotation per team. Each reviewer carries an assignment count, and
  the next one is whoever is owed a review.
- Tags (for example `frontend`, `backend`) with an independent rotation per tag.
- Force-assign a specific reviewer, or mark an assignment as urgent.
- Duplicate PR detection, and undo for the last assignment.
- Cross-team assignment: request a review from another team's pool and notify
  both teams' Google Chat spaces.
- Assignment history, a live feed and a "my assignments" view, all updated in
  real time through Convex.

**Availability**

- Mark reviewers absent until a given time; they return to the rotation
  automatically.
- Planned absences (vacations) scheduled by date, evaluated in the team's time
  zone.
- Part-time schedules: pick the weekdays someone works.
- Per-reviewer settings to stay out of the general pool or tag rotations.

**Team tooling**

- Google Chat notifications per team webhook, with optional AI-drafted messages
  (Google Generative AI, off unless you set a key).
- Team events (estimations, plannings, retros) with start notifications.
- Birthday notifications, web push notifications (PWA) and keyboard shortcuts.
- Suggestions board with votes and comments, and team surveys.
- Team backups and a product metrics page.
- Teams with owner and member roles.

**Integrations**

- **MCP server** at `/api/mcp` (Streamable HTTP) with personal Bearer tokens.
  Tools: `la_lista_get_context`, `la_lista_preview_assignment` and
  `la_lista_assign_pr`. Tokens are created in the app and installed with a single
  `claude mcp add --transport http` command. A plain REST version lives under
  `/api/agent/*`.
- **Chrome extension** (Manifest V3) that assigns a reviewer from any GitHub pull
  request page. See [chrome-extension/README.md](chrome-extension/README.md).

**Administration**

- Admin console at `/{locale}/admin`: access policy (open, by email domain, or by
  regex), admins, teams and roles, announcements, feature toggles, app settings
  and maintenance tasks. Details in [DEPLOYMENT.md](DEPLOYMENT.md).

## Stack

| Layer | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Backend and database | [Convex](https://convex.dev): queries, mutations, actions, crons, HTTP actions |
| Auth | [Clerk](https://clerk.com) (JWT template named `convex`) |
| UI | Tailwind CSS 4, shadcn/ui with Radix and Base UI, Framer Motion |
| i18n | next-intl (`es`, `en`) |
| AI and agents | Vercel AI SDK with Google Generative AI, `@modelcontextprotocol/sdk` |
| Tooling | pnpm, Biome, lefthook, Node test runner, Playwright |
| Hosting | Vercel + Convex Cloud, or Docker + self-hosted Convex + Postgres |

```
app/          Next.js routes ([locale]/...), server actions, /api/mcp and /api/agent
components/   UI (ui/ = shadcn, pr-review/ = assignment tool, admin/, ...)
convex/       schema, queries, mutations, actions, crons, HTTP actions
chrome-extension/  MV3 extension (Vite + React)
messages/     en.json, es.json
lib/          shared logic (assignment resolver, agent API/MCP, access policy)
scripts/      Vercel build helpers and selfhost.sh
tests/        unit tests (tests/unit) and e2e (tests/e2e)
```

[AGENTS.md](AGENTS.md) has the architecture notes and conventions;
[DESIGN.md](DESIGN.md) documents the design system.

## Run it locally

Requirements: Node.js 20+, [pnpm](https://pnpm.io), a free
[Convex](https://convex.dev) account and a [Clerk](https://clerk.com)
application.

```bash
pnpm install
```

1. **Convex.** Run `pnpm exec convex dev` once. It creates a development
   deployment and writes `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` to
   `.env.local`. Leave it running to sync `convex/` as you edit.
2. **Clerk.** Create an application, then add a JWT template named exactly
   `convex` (Clerk has a Convex preset). Put its Issuer URL in
   `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment
   (`pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <issuer>`) and add the
   Clerk keys to `.env.local`.
3. **Admin access.** Set `ADMIN_ALLOWLIST_EMAILS` on the Convex deployment to
   your email so you can open the admin console the first time.
4. **Start the app.**

```bash
pnpm run dev    # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose | Required |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | web | Convex deployment URL (written by `convex dev`) | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | web | Clerk secret key | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | web | Sign-in and sign-up paths (`/sign-in`, `/sign-up`) | Yes |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex | Issuer of the Clerk `convex` JWT template | Yes |
| `ADMIN_ALLOWLIST_EMAILS` | Convex | Comma-separated bootstrap admins (break-glass) | Recommended |
| `EMAIL_ACCESS_ALLOWED_DOMAINS` / `EMAIL_ACCESS_ALLOWED_PATTERN` | Convex | Deploy closed: only these domains or this regex may sign in, until an admin saves a policy | No |
| `EMAIL_ACCESS_ALLOW_CLERK_TEST_EMAILS` | Convex | Let `+clerk_test@example.com` aliases through (E2E only) | No |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` | web + Convex | Web push (`npx web-push generate-vapid-keys`) | No |
| `GOOGLE_GENERATIVE_AI_API_KEY` | web | AI-drafted Google Chat messages | No |
| `UNSPLASH_ACCESS_KEY` | web | Landing page imagery | No |

Google Chat webhooks are configured per team inside the app, not through the
environment.

### Scripts

```bash
pnpm run dev           # Next.js dev server (Turbopack)
pnpm run build         # production build
pnpm run lint          # Biome
pnpm run biome:fix     # Biome with safe fixes
pnpm run test          # unit tests (node --test via tsx)
pnpm run test:e2e      # Playwright
pnpm run ext:build     # build the Chrome extension
pnpm run ext:pack      # build and zip the extension
```

For local sign-in during tests, see "Local Authentication and E2E" in
[AGENTS.md](AGENTS.md).

## Deploy

**Vercel + Convex Cloud.** `vercel.json` runs `scripts/vercel-build.mjs`, which
deploys `convex/` with `convex deploy` and then builds Next.js. Set
`CONVEX_DEPLOY_KEY`, the Clerk variables and the optional ones above in the
Vercel project. If there is no usable deploy key for the environment, the script
skips the Convex deploy and builds Next.js only.

**Self-hosted.** Docker Compose runs the web app, the open-source Convex backend
and Postgres. Only Docker is required on the host.

```bash
cp .env.selfhost.example .env     # fill in the three Clerk values
./scripts/selfhost.sh bootstrap
```

That generates secrets, starts the stack, deploys `convex/` and serves the app on
<http://localhost:3000>. Reverse proxy, managed Postgres, backups and the Chrome
extension build for your own domain are covered in [DEPLOYMENT.md](DEPLOYMENT.md).
Clerk stays external: it is SaaS only.

## License

Code under the Functional Source License 1.1 (FSL-1.1-ALv2). You can read, use,
modify and self-host the code for any purpose except offering a product or
service that competes commercially with this one. Each version automatically
becomes Apache 2.0 two years after its release. See [LICENSE.md](LICENSE.md).

## Author

Hugo Castro, [github.com/HugoCL](https://github.com/HugoCL) ·
[hugocastro.dev](https://hugocastro.dev)
