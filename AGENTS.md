# Project Overview: Round Robin RMPE (La Lista)

**La Lista** is a Pull Request (PR) review assignment tool designed to help teams manage their code review process efficiently using a round-robin algorithm with availability tracking. It supports multiple teams, internationalization (English/Spanish), and real-time updates.

## Tech Stack

*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Backend & Database:** Convex (Real-time database and serverless functions)
*   **Authentication:** Clerk
*   **Styling:** Tailwind CSS, shadcn/ui (Radix UI), `class-variance-authority`
*   **Internationalization:** `next-intl`
*   **Linting & Formatting:** Biome
*   **AI Integration:** Vercel AI SDK
*   **PWA:** Progressive Web App support with Web Push notifications

## Architecture

*   **Frontend:**
    *   Built with Next.js App Router (`app/` directory).
    *   Uses a `[locale]` dynamic route strategy for internationalization.
    *   Global layout (`app/layout.tsx`) integrates Clerk, Convex, and Theme providers.
*   **Backend:**
    *   Powered by Convex (`convex/` directory).
    *   `schema.ts` defines the data model (Teams, Reviewers, Assignments, Events).
    *   Server-side logic resides in queries, mutations, and actions within the `convex/` folder.
*   **Authentication:**
    *   `middleware.ts` combines Clerk authentication with `next-intl` routing middleware.
    *   Most routes are protected, with exceptions for public pages (landing, sign-in/up).

## Directory Structure

*   `app/`: Next.js App Router source code.
    *   `[locale]/`: Localized routes.
    *   `actions/`: Server Actions (e.g., AI generation).
    *   `api/`: API routes (e.g., for AI streaming).
*   `components/`: React components.
    *   `ui/`: Reusable UI components (shadcn/ui).
    *   `pr-review/`: Domain-specific components for the review tool.
*   `convex/`: Convex backend code.
    *   `schema.ts`: Database schema definition.
    *   `_generated/`: Auto-generated Convex types.
*   `hooks/`: Custom React hooks (e.g., `useLocalStorage`, `useConvexPRReviewData`).
*   `i18n/`: Internationalization configuration.
*   `messages/`: JSON files for translation strings (`en.json`, `es.json`).
*   `lib/`: Utility functions and type definitions.

## Key Development Commands

### Building and Running

*   **Development Server:**
    ```bash
    npm run dev
    # Runs Next.js with Turbopack
    ```
*   **Production Build:**
    ```bash
    npm run build
    ```
*   **Start Production Server:**
    ```bash
    npm run start
    ```

### Code Quality

*   **Linting & Formatting:**
    ```bash
    npm run lint
    # Uses Biome to lint the project
    ```
*   **Fix Lint Issues:**
    ```bash
    npm run biome:fix
    # Automatically fixes safe linting errors
    ```

### Convex

*   **Run Convex Dev:** (Implicitly run typically, but standard command is `npx convex dev`)
*   **Deploy Convex:** `npx convex deploy`

## Conventions

*   **Styling:** Use Tailwind CSS utility classes. Avoid custom CSS files when possible. Use `cn()` helper for class merging.
*   **Components:** Prefer creating small, reusable components in `components/ui` for generic UI elements, and `components/pr-review` for feature-specific logic.
*   **State Management:** Use Convex `useQuery` and `useMutation` for server state. Use React `useState` / `useReducer` for local UI state.
*   **Internationalization:** All user-facing text must be localized using `next-intl`. Add keys to `messages/{locale}.json`.
*   **Imports:** Use absolute imports via the `@/` alias (e.g., `@/components/ui/button`).

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md<!-- NEXT-AGENTS-MD-END -->
