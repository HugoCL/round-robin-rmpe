/**
 * The registry of app-wide feature toggles.
 *
 * Each entry is a switch an admin can flip from the console. Some features
 * also need an API key, and a toggle cannot conjure one, so the resolved state
 * keeps the admin's intent and whether the requirements are met as separate
 * facts. Only `enabled` should gate behaviour.
 */

/** Where an environment variable actually lives, which decides who can see it. */
export type RequirementScope = "convex" | "web";

export type FeatureRequirement = {
	envVar: string;
	scope: RequirementScope;
};

export type FeatureDefinition = {
	key: string;
	/** Value used when the admin has never touched this toggle. */
	defaultEnabled: boolean;
	requirements: FeatureRequirement[];
};

export const APP_FEATURES = [
	{
		key: "events",
		defaultEnabled: true,
		requirements: [],
	},
	{
		key: "birthdays",
		defaultEnabled: true,
		requirements: [],
	},
	{
		key: "surveys",
		defaultEnabled: true,
		requirements: [],
	},
	{
		key: "suggestionsBoard",
		defaultEnabled: true,
		requirements: [],
	},
	{
		key: "agentMcp",
		defaultEnabled: true,
		requirements: [],
	},
	{
		key: "crossTeamAssignment",
		defaultEnabled: true,
		requirements: [],
	},
	{
		key: "pushNotifications",
		defaultEnabled: true,
		requirements: [
			{ envVar: "VAPID_PRIVATE_KEY", scope: "convex" },
			{ envVar: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", scope: "convex" },
		],
	},
	{
		key: "aiChatDrafting",
		defaultEnabled: true,
		requirements: [{ envVar: "GOOGLE_GENERATIVE_AI_API_KEY", scope: "web" }],
	},
	{
		key: "landingImagery",
		defaultEnabled: true,
		requirements: [{ envVar: "UNSPLASH_ACCESS_KEY", scope: "web" }],
	},
] as const satisfies readonly FeatureDefinition[];

export type AppFeatureKey = (typeof APP_FEATURES)[number]["key"];

export const APP_FEATURE_KEYS = APP_FEATURES.map(
	(feature) => feature.key,
) as AppFeatureKey[];

export function isAppFeatureKey(value: string): value is AppFeatureKey {
	return (APP_FEATURE_KEYS as string[]).includes(value);
}

export function getFeatureDefinition(
	key: AppFeatureKey,
): FeatureDefinition | undefined {
	return APP_FEATURES.find((feature) => feature.key === key);
}

export type FeatureState = {
	key: AppFeatureKey;
	/** What the admin asked for, independent of whether it can be honoured. */
	toggle: boolean;
	requirementsMet: boolean;
	/** Variable NAMES only. Never carry a value out of the environment. */
	missingRequirements: string[];
	/** The only field callers should branch on. */
	enabled: boolean;
};

/**
 * @param presentEnvVars names of variables that are set. Callers pass what
 *   they can see: Convex knows its own deployment, the Next server knows its
 *   own process, and neither can see the other's.
 */
export function resolveFeatureState(
	definition: FeatureDefinition,
	storedToggles: Record<string, boolean> | undefined,
	presentEnvVars: ReadonlySet<string>,
	{ scopes }: { scopes: ReadonlySet<RequirementScope> },
): FeatureState {
	const toggle = storedToggles?.[definition.key] ?? definition.defaultEnabled;

	// Only judge requirements this caller can actually observe. A Convex query
	// asked about a web-only key would otherwise report it as missing.
	const missingRequirements = definition.requirements
		.filter((requirement) => scopes.has(requirement.scope))
		.filter((requirement) => !presentEnvVars.has(requirement.envVar))
		.map((requirement) => requirement.envVar);

	const requirementsMet = missingRequirements.length === 0;

	return {
		key: definition.key as AppFeatureKey,
		toggle,
		requirementsMet,
		missingRequirements,
		enabled: toggle && requirementsMet,
	};
}

export function resolveAllFeatureStates(
	storedToggles: Record<string, boolean> | undefined,
	presentEnvVars: ReadonlySet<string>,
	options: { scopes: ReadonlySet<RequirementScope> },
): Record<AppFeatureKey, FeatureState> {
	const result = {} as Record<AppFeatureKey, FeatureState>;
	for (const definition of APP_FEATURES) {
		result[definition.key] = resolveFeatureState(
			definition,
			storedToggles,
			presentEnvVars,
			options,
		);
	}
	return result;
}

/** Merges what Convex could see with what the Next server could see. */
export function mergeFeatureStates(
	convexStates: Record<string, FeatureState>,
	webMissing: ReadonlySet<string>,
): Record<string, FeatureState> {
	const merged: Record<string, FeatureState> = {};
	for (const [key, state] of Object.entries(convexStates)) {
		const definition = APP_FEATURES.find((feature) => feature.key === key);
		const webMissingForFeature = (definition?.requirements ?? [])
			.filter((requirement) => requirement.scope === "web")
			.filter((requirement) => webMissing.has(requirement.envVar))
			.map((requirement) => requirement.envVar);

		const missingRequirements = [
			...state.missingRequirements,
			...webMissingForFeature,
		];
		const requirementsMet = missingRequirements.length === 0;
		merged[key] = {
			...state,
			missingRequirements,
			requirementsMet,
			enabled: state.toggle && requirementsMet,
		};
	}
	return merged;
}
