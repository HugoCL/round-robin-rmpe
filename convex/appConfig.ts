import {
	type AppFeatureKey,
	type RequirementScope,
	resolveAllFeatureStates,
} from "../lib/appFeatures";
import { canAccessApp } from "../lib/emailAccess";
import { query } from "./_generated/server";
import { getResolvedAppSettings } from "./appSettings";
import { type AuthCtx, isAdminEmail } from "./authz";

/**
 * Environment variables this Convex deployment can see.
 *
 * Only presence is ever reported; values never leave the backend. Web-only
 * keys (Gemini, Unsplash) are deliberately absent here because the Next server
 * owns them, and claiming they are missing would be wrong.
 */
const CONVEX_SCOPE: ReadonlySet<RequirementScope> = new Set(["convex"]);

function presentConvexEnvVars(): ReadonlySet<string> {
	const present = new Set<string>();
	for (const name of ["VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) {
		if (process.env[name]?.trim()) present.add(name);
	}
	return present;
}

export async function getFeatureStates(ctx: AuthCtx) {
	const settings = await getResolvedAppSettings(ctx);
	return resolveAllFeatureStates(
		settings.featureToggles,
		presentConvexEnvVars(),
		{
			scopes: CONVEX_SCOPE,
		},
	);
}

/**
 * A toggle that is only honoured by the client is decoration. Mutations behind
 * a feature call this so turning something off actually stops it.
 */
export async function assertFeatureEnabled(ctx: AuthCtx, key: AppFeatureKey) {
	const states = await getFeatureStates(ctx);
	if (!states[key]?.enabled) {
		throw new Error(`FeatureDisabled: ${key}`);
	}
}

/**
 * The single client-facing runtime configuration query.
 *
 * Every page that needs to know "who am I and what is turned on" subscribes to
 * this one query through AppConfigProvider, so adding a config-driven surface
 * never adds a request waterfall.
 *
 * Deliberately callable while signed out: the sign-in screen and the landing
 * page render before Clerk resolves an identity.
 */
export const getRuntimeConfig = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		const settings = await getResolvedAppSettings(ctx);
		const email = identity?.email ?? null;
		const isAdmin = await isAdminEmail(ctx, email);

		return {
			isAuthenticated: identity !== null,
			isAdmin,
			emailAccess: settings.emailAccess,
			// Resolved server-side so the client never re-derives the rule and
			// the two cannot drift.
			canAccessApp: identity
				? canAccessApp({ email, policy: settings.emailAccess, isAdmin })
				: false,
			features: resolveAllFeatureStates(
				settings.featureToggles,
				presentConvexEnvVars(),
				{ scopes: CONVEX_SCOPE },
			),
		};
	},
});
