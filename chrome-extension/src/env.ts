// Build-time configuration for the extension.
//
// Defaults reproduce the hosted La Lista deployment, so an unconfigured
// `pnpm run build` keeps producing exactly the extension we ship today.
// Self-hosters point these at their own stack via a `.env` file beside
// this package (see DEPLOYMENT.md):
//
//   VITE_CONVEX_URL=https://convex.example.com
//   VITE_CONVEX_SITE_URL=https://convex-http.example.com
//   VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
//   VITE_SYNC_HOST=https://lalista.example.com

const fallback = <T extends string>(value: string | undefined, def: T): string =>
	value && value.length > 0 ? value : def;

/** Convex client API — queries, mutations, websocket. Backend port 3210. */
export const CONVEX_URL = fallback(
	import.meta.env.VITE_CONVEX_URL,
	"https://admired-weasel-950.convex.cloud",
);

/** Convex HTTP actions, e.g. POST /flash-assign. Backend port 3211. */
export const CONVEX_SITE_URL = fallback(
	import.meta.env.VITE_CONVEX_SITE_URL,
	"https://admired-weasel-950.convex.site",
);

export const CLERK_PUBLISHABLE_KEY = fallback(
	import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
	"pk_test_dGlkeS1zdGluZ3JheS04MS5jbGVyay5hY2NvdW50cy5kZXYk",
);

/**
 * The web app origin the extension syncs its Clerk session with. OAuth cannot
 * run inside an extension popup, so Clerk's Sync Host feature reuses the
 * session established on the web app.
 */
export const SYNC_HOST = fallback(
	import.meta.env.VITE_SYNC_HOST,
	"https://la-lista.vercel.app",
);
