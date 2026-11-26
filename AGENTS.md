# Project Overview: Round Robin RMPE (La Lista)

**La Lista** is a Pull Request (PR) review assignment tool designed to help teams manage their code review process efficiently using a round-robin algorithm with availability tracking. It supports multiple teams, internationalization (English/Spanish), and real-time updates.

## Tech Stack

* **Framework:** Next.js 16 (App Router)
* **Language:** TypeScript
* **Backend & Database:** Convex (Real-time database and serverless functions)
* **Authentication:** Clerk
* **Styling:** Tailwind CSS, `class-variance-authority`; UI primitives moving from shadcn/ui (Radix UI) to [UI SDK](https://ui-sdk.dev) (`@ui-sdk/react` + `@ui-sdk/core`, beta). See "UI primitives: UI SDK" below.
* **Internationalization:** `next-intl`
* **Linting & Formatting:** Biome
* **AI Integration:** Vercel AI SDK
* **PWA:** Progressive Web App support with Web Push notifications

## Architecture

* **Frontend:**
  * Built with Next.js App Router (`app/` directory).
  * Uses a `[locale]` dynamic route strategy for internationalization.
  * Global layout (`app/layout.tsx`) integrates Clerk, Convex, and Theme providers.
* **Backend:**
  * Powered by Convex (`convex/` directory).
  * `schema.ts` defines the data model (Teams, Reviewers, Assignments, Events).
  * Server-side logic resides in queries, mutations, and actions within the `convex/` folder.
* **Authentication:**
  * `proxy.ts` combines Clerk authentication with `next-intl` routing middleware.
  * Most routes are protected, with exceptions for public pages (landing, sign-in/up).

## Directory Structure

* `app/`: Next.js App Router source code.
  * `[locale]/`: Localized routes.
  * `actions/`: Server Actions (e.g., AI generation).
  * `api/`: API routes (e.g., for AI streaming).
* `components/`: React components.
  * `ui/`: Reusable UI components (shadcn/ui).
  * `pr-review/`: Domain-specific components for the review tool.
* `convex/`: Convex backend code.
  * `schema.ts`: Database schema definition.
  * `_generated/`: Auto-generated Convex types.
* `hooks/`: Custom React hooks (e.g., `useLocalStorage`, `useConvexPRReviewData`).
* `i18n/`: Internationalization configuration.
* `messages/`: JSON files for translation strings (`en.json`, `es.json`).
* `lib/`: Utility functions and type definitions.

## Key Development Commands

### Building and Running

* **Development Server:**

    ```bash
    pnpm run dev
    # Runs Next.js with Turbopack
    ```

* **Production Build:**

    ```bash
    pnpm run build
    ```

* **Start Production Server:**

    ```bash
    pnpm run start
    ```

### Code Quality

* **Linting & Formatting:**

    ```bash
    pnpm run lint
    # Uses Biome to lint the project
    ```

* **Fix Lint Issues:**

    ```bash
    pnpm run biome:fix
    # Automatically fixes safe linting errors
    ```

### Convex

* **Run Convex Dev:** (Implicitly run typically, but standard command is `pnpm exec convex dev`)
* **Deploy Convex:** `pnpm exec convex deploy`

### Local Authentication and E2E

* Use `http://localhost:3000` for local app and browser tests. If port 3000 is occupied, choose another explicit `localhost` port (for example, `E2E_PORT=3100 pnpm run test:e2e`). Never use `127.0.0.1`.
* Set `NEXT_PUBLIC_ALLOW_CLERK_TEST_EMAILS=true` in `.env.local` for local testing only. Never enable it in production.
* Sign in with a unique address ending in `+clerk_test@example.com`, choose the email-code option, and enter `424242`.
* The Clerk development instance must have email verification codes enabled for the email-code option to appear.

## Conventions

* **Styling:** Use Tailwind CSS utility classes. Avoid custom CSS files when possible. Use `cn()` helper for class merging.
* **Components:** Prefer creating small, reusable components in `components/ui` for generic UI elements, and `components/pr-review` for feature-specific logic.
* **State Management:** Use Convex `useQuery` and `useMutation` for server state. Use React `useState` / `useReducer` for local UI state.
* **Internationalization:** All user-facing text must be localized using `next-intl`. Add keys to `messages/{locale}.json`.
* **Imports:** Use absolute imports via the `@/` alias (e.g., `@/components/ui/button`).

## UI primitives: UI SDK

The wrappers in `components/ui/` are moving from Radix/shadcn (plus some base-ui, vaul and Radix Toast) to [UI SDK](https://ui-sdk.dev) (Vercel): unstyled, accessible primitives that handle focus, keyboard, selection, popups and ARIA. The look stays La Lista's own Tailwind classes; UI SDK only replaces behavior. Migrated: Button, Dialog, Alert Dialog, Sheet, Drawer, Select, Dropdown Menu (UI SDK Menu), Popover, Tooltip, Collapsible, Avatar, Separator, Scroll Area, the toast stack, and the form primitives: Switch, Checkbox, Radio Group, Toggle, Toggle Group, Tabs, Label, Field, Input, Textarea and Input Group. Badge renders through UI SDK's `renderElement`. Only Calendar is still on another library (daypicker); the app no longer depends on Radix or vaul.

* Before using a UI SDK component, read `node_modules/@ui-sdk/react/docs/llms.txt`, then only the component pages you need (`docs/components/<name>.md`), plus `popups.md`, `styling-and-animation.md`, `forms.md` and `parts-and-composition.md` for anything that opens or submits. Always read the copy in `node_modules` (the installed version), not docs from the web or another repo. To build a component it does not ship, search `docs/core.md` by heading (it is large) and read `rendering.md` next to it.
* Import each component from its entry (`@ui-sdk/react/dialog`), never from a package root.
* Keep the exported names and props of the `components/ui/*` wrappers so call sites stay unchanged; map Radix-only props inside the wrapper. `asChild` on the migrated wrappers maps to UI SDK's `render` prop.
* Do not import `@ui-sdk/core/web.css`: it restyles bare `a`, `code`, `kbd` and `hr` app-wide, and La Lista keeps its own look. `app/globals.css` declares `@layer ui-sdk;` on its first line so Tailwind utilities win over the small CSS UI SDK injects.
* Style parts by `data-slot` and state attributes (`data-open`, `data-closed`, `data-checked`, `data-highlighted`, `data-side`) and the CSS variables each component page lists (`--transform-origin`, `--anchor-width`, `--available-height`). The shadcn `data-open:`/`data-closed:`/`data-checked:`/`data-disabled:` Tailwind variants match both Radix's `data-state` and UI SDK's bare attributes.
* UI SDK popups (dialog, alert dialog, sheet, drawer, menu, select, popover, tooltip, toast) render in place in the DOM and paint in the browser's top layer, without portals. Popups opened from inside one another stack on their own: Escape and outside presses reach the topmost, and a dialog opened from a drawer or sheet (inside its DOM or next to it) takes presses, focus and typing.
* Their parts are children of whatever element renders them, so don't render a popup inside a `space-y-*` container: its margins land on the popup's fixed parts and on the sibling before them (a drawer grew 8px when a dialog inside it opened). Flex or grid `gap` is fine.
* The sheet is a UI SDK Dialog pinned to an edge, with the same CSS slide and fade it had. The drawer is UI SDK's Drawer with `driver="pointer"` (it follows a finger as vaul did and rests exactly at the edge; in testing, the touch default, native scroll snapping, rested a fraction of a pixel off and synthesized touch swipes didn't move it). Its viewport pins and slides the content: style its size and surface by `data-side`, and never give the content margins, `translate`, or position, or the backdrop an opacity or fade.
* Because they render in place, `globals.css` resets the inherited text styles of ui-sdk popup roots to the page defaults, and menus, selects, popovers and tooltips default to `collisionPadding={0}` as Radix did. A new ui-sdk popup wrapper needs its `data-slot` added to that reset.
* Every UI SDK part sets its own `data-slot` (`input`, `textarea`, `toggle`, `tabs-tab`, `tabs-panel`, `radio`, `label`), and a caller's `data-slot` is dropped. Select a part by the slot UI SDK gives it.
* Tabs mark the selected tab and panel with a bare `data-selected`, so their classes use `data-[selected]:` (shadcn's `data-selected:` only matches `="true"`). Toggles use `data-[pressed]:` or `aria-pressed:`, not `data-[state=on]:`.
* Switch, Checkbox and Radio render a visually hidden native input right after the button, so it can take part in forms. The wrappers keep Radix's Enter behavior: Enter toggles a switch, and does nothing on a checkbox or radio. UI SDK would submit the surrounding form instead. Change callbacks (`onCheckedChange`, `onValueChange`, `onPressedChange`) get only the new value, as in Radix.
* `Field` is UI SDK's field. Its label names the control and its description describes it, by context, and a caller's `htmlFor`/`id` pair still wins. `data-invalid` and `data-disabled` on a `Field` stay styling hooks. UI SDK's `invalid` and `disabled` props are opt-in. In a form that validates natively (no `noValidate`), a failed submit marks a `required` control inside a `Field` with `aria-invalid`. `FieldError` always shows (`match`), because callers render it only when there is an error.
* The Button wrapper keeps native semantics: `type` defaults to `"submit"`, and `onClick`'s return value is ignored so a Promise doesn't turn on ui-sdk's pending state (which also swallows errors into state). Menu item `onSelect`, toast actions and alert dialog Action/Cancel (Close parts rendered as our Button) follow the same rule. Opt into pending per call site only on purpose.
* Tooltip: `TooltipProvider` only sets the delay for the tooltips inside it (ui-sdk groups tooltips without a provider). `sideOffset` excludes the arrow, as in Radix (the wrapper adds its 10px). The content renders as a `span`, so a trigger can sit in a `<p>`. `WithTooltip` keeps a span host as the trigger: it takes the hover of a disabled button (`disabled:pointer-events-none`) and carries `className`. Focus that a ui-sdk popup returns to a trigger doesn't open its tooltip.
* The packages are pinned (exact) to `0.1.0-beta.16`, the newest beta past pnpm's `minimumReleaseAge` on 2026-11-26. Bump `@ui-sdk/react` and `@ui-sdk/core` together, to the same version, and never loosen the pnpm policy to get a newer one.
* The shadcn CLI is no longer used to add or update primitives. The `shadcn` package stays only for `shadcn/tailwind.css` (custom variants and utilities) imported in `globals.css`.

## Launch Videos

Every feature launch ships with a short video in its changelog entry (`video` in `lib/changelog.ts`), made and reviewed before the feature's PR merges.

* The repository is public, so a video shows seeded demo teams only, never real teams or people. `scripts/launch-video/recorder.mjs` seeds and records against this checkout's local Convex backend only, and stops if the app reaches any other backend.
* Each launch gets a scenario file next to the recorder (see `scripts/launch-video/multi-team-membership.mjs`). The recorder drives the real app, draws the pointer, burns the captions in under the picture, and writes the MP4 and its poster to `public/changelog/`. It needs `ffmpeg`.
* To record, in a checkout whose `.env.local` holds only the Clerk keys:
  1. `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --typecheck disable` starts a local backend and writes its URL to `.env.local`. Discard the changes it makes to `convex/_generated/` and the `convex/tsconfig.json` it creates.
  2. `CONVEX_AGENT_MODE=anonymous pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <Clerk issuer URL>`.
  3. `pnpm exec next dev --turbopack --hostname localhost --port 3100` (any free port).
  4. `E2E_PORT=3100 LAUNCH_VIDEO_EMAIL=<Clerk test user, a +clerk_test address> node --env-file=.env.local scripts/launch-video/<scenario>.mjs`.
* Captions are Spanish, short, and follow the UI copy rules in `DESIGN.md`.
* A launch big enough to tell everyone about also gets a `spotlight` in its changelog entry. Each person then sees it once in a corner card when they open the list, until they dismiss it or 30 days pass. Keep it for changes that move what people see every day.
* When the view holds other things, zoom in on what matters with `zoomOn` and ease back out for the result. Keep it mild; the default is 1.35x.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Do not add `Made-with: Cursor` or similar commit-message trailers when creating commits for this user.
- Use pnpm for installs and package scripts in this repository, not npm.
- When the user writes in Spanish, reply in Latin American / neutral Spanish (not Spain-centric) unless they switch to English.
- Prefers warm, personal product microcopy over generic phrasing when tuning user-facing messages.

## Learned Workspace Facts

- The repository includes a `chrome-extension/` package alongside the Next.js web app.
- Team-scoped FF Repository (`featureFlags` in Convex) registers flags and tracks age. It has a full authorized CRUD backend but **no UI and no readers** in the app; the route `/{locale}/{team}/feature-flags` referenced by older notes does not exist.
- Admin console at `/{locale}/admin` (`components/admin/`, tabs: access, teams, users, announcements, features, settings, maintenance). Admin identity is `ADMIN_ALLOWLIST_EMAILS` (break-glass, checked first) OR the `appAdmins` table. App-wide configuration lives in the `appSettings` singleton; read it through `getResolvedAppSettings` and the pure helpers in `lib/appSettings.ts`.
- `isAdminEmail(ctx, email)` is async and takes `ctx` first, deliberately: an un-awaited async predicate is always truthy, so the extra parameter turns a missed call site into a compile error.
- Reviewers have `role: "owner" | "member"`, optional because deployed rows predate it. Always read it via `resolveReviewerRole()`; a direct `role === "owner"` check treats every legacy row as a member.
- `assertCanAdministerTeamById` grandfathers teams with zero owners down to member level, so the owner requirement activates per team as the backfill reaches it rather than all at once on deploy. Pass `grandfatherOwnerlessTeams: false` for anything that must not be reachable that way; granting a role is the one such case.
- The email access policy falls back to `EMAIL_ACCESS_ALLOWED_PATTERN` / `EMAIL_ACCESS_ALLOWED_DOMAINS` while no policy is stored, so an instance can deploy closed without a seeding step. A stored policy always wins, and an unparseable variable denies everyone but admins rather than opening the instance.
- Do not hold Convex `FunctionReference` values in a module-level const inside a `convex/` module: it makes the generated `api` type circular and silently degrades inference across the app to `any`. Resolve refs inside the handler (see `convex/adminOps.ts`).
- Agent MCP is served at `/api/mcp` with personal Bearer tokens; settings documents install via a single copyable `claude mcp add --transport http` one-liner (not manual `settings.json` JSON).
- Daily `cleanupOldRecords` cron deletes completed/cancelled events and other old assignment records after 7 days.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
