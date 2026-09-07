/**
 * Pure resolution and clamping for the app-wide settings singleton.
 *
 * Every knob here used to be a code constant or an env var, which meant a
 * deploy (or `npx convex run`) to change. The Convex side stores one
 * `appSettings` row; this module owns the defaults and the bounds so both the
 * backend and the admin console agree on what a stored value means.
 *
 * Values are clamped on write AND on read: a row written by an older version
 * (or by hand in the Convex dashboard) can hold anything.
 */

export type EmailAccessMode = "open" | "domains" | "pattern";

export type EmailAccessPolicy = {
	mode: EmailAccessMode;
	allowedDomains?: string[];
	allowedEmailPattern?: string;
	allowClerkTestEmails?: boolean;
};

export type OpsSettings = {
	retentionDays: number;
	assignmentFeedLength: number;
	backupsPerTeam: number;
	debugMessageLimit: number;
	defaultEventDurationMinutes: number;
	birthdayNotifyLocalHour: number;
	defaultTeamTimezone?: string;
};

export type AppSettingsInput = {
	emailAccess?: Partial<EmailAccessPolicy> | null;
	featureToggles?: Record<string, boolean> | null;
	ops?: Partial<OpsSettings> | null;
} | null;

export type ResolvedAppSettings = {
	emailAccess: EmailAccessPolicy;
	featureToggles: Record<string, boolean>;
	ops: OpsSettings;
};

/**
 * Defaults reproduce the behaviour that was hardcoded before the admin console
 * existed, so an instance with no `appSettings` row behaves exactly as before.
 */
export const DEFAULT_EMAIL_ACCESS: EmailAccessPolicy = {
	mode: "open",
	allowedDomains: [],
	allowClerkTestEmails: false,
};

/**
 * A policy that matches nobody.
 *
 * Used when the environment asks for a restriction we cannot parse. Failing
 * closed is safe here precisely because admins bypass the policy
 * unconditionally, so the operator can still sign in and fix it in the console.
 */
export const DENY_ALL_EMAIL_ACCESS: EmailAccessPolicy = {
	mode: "pattern",
	allowedEmailPattern: "(?!)",
	allowedDomains: [],
	allowClerkTestEmails: false,
};

export const DEFAULT_OPS: OpsSettings = {
	retentionDays: 7,
	assignmentFeedLength: 5,
	backupsPerTeam: 20,
	debugMessageLimit: 3,
	defaultEventDurationMinutes: 20,
	birthdayNotifyLocalHour: 9,
};

type Bounds = { min: number; max: number };

export const OPS_BOUNDS: Record<
	keyof Omit<OpsSettings, "defaultTeamTimezone">,
	Bounds
> = {
	retentionDays: { min: 1, max: 365 },
	assignmentFeedLength: { min: 1, max: 20 },
	backupsPerTeam: { min: 1, max: 100 },
	debugMessageLimit: { min: 1, max: 200 },
	defaultEventDurationMinutes: { min: 5, max: 480 },
	birthdayNotifyLocalHour: { min: 0, max: 23 },
};

/** Guards against a stored `Infinity`, `NaN`, or a float where a count is expected. */
export function clampInteger(
	value: number | undefined | null,
	{ min, max }: Bounds,
	fallback: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const rounded = Math.round(value);
	if (rounded < min) return min;
	if (rounded > max) return max;
	return rounded;
}

/** Lowercases, strips a leading "@", and drops anything that is not a plausible domain. */
export function normalizeDomain(value: string): string | null {
	const normalized = value.trim().toLowerCase().replace(/^@+/, "");
	if (normalized.length === 0 || normalized.length > 253) return null;
	if (
		!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
			normalized,
		)
	) {
		return null;
	}
	return normalized;
}

export function normalizeDomains(
	values: readonly string[] | undefined | null,
): string[] {
	if (!values) return [];
	const seen = new Set<string>();
	for (const raw of values) {
		const domain = normalizeDomain(raw);
		if (domain) seen.add(domain);
	}
	return [...seen].sort();
}

/** Length-capped so an admin cannot store a pattern that is expensive to run. */
export const MAX_EMAIL_PATTERN_LENGTH = 200;

export function isValidEmailPattern(
	pattern: string | undefined | null,
): boolean {
	if (!pattern) return false;
	if (pattern.length > MAX_EMAIL_PATTERN_LENGTH) return false;
	try {
		new RegExp(pattern);
		return true;
	} catch {
		return false;
	}
}

/**
 * An access policy supplied by the environment.
 *
 * The stored policy is authoritative once an admin saves one, so this exists
 * for the window before that happens: a fresh instance, or an existing one
 * upgrading from the era when the rule was a hardcoded regex. Without it the
 * "open" default would silently widen access on deploy day, and the mutation
 * that seeds a policy cannot help because it requires a signed-in admin and so
 * cannot be run from the CLI.
 *
 * Same shape of promise as ADMIN_ALLOWLIST_EMAILS: set it once at deploy time,
 * then manage everything from the console.
 */
export type EmailAccessEnv = {
	domains?: string | null;
	pattern?: string | null;
	allowClerkTestEmails?: string | null;
};

export type EmailAccessEnvResult = {
	/** null when the environment says nothing about access. */
	policy: EmailAccessPolicy | null;
	/** Set when the environment asked for something that could not be parsed. */
	error: string | null;
};

function isTruthyEnv(value: string | null | undefined): boolean {
	const normalized = value?.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function parseEmailAccessEnv(env: EmailAccessEnv): EmailAccessEnvResult {
	const allowClerkTestEmails = isTruthyEnv(env.allowClerkTestEmails);
	const pattern = env.pattern?.trim();
	const rawDomains = env.domains?.trim();

	// An unparseable restriction denies rather than opens. The operator asked
	// for a closed instance; giving them an open one because of a typo is the
	// worse of the two failures.
	if (pattern) {
		if (!isValidEmailPattern(pattern)) {
			return {
				policy: DENY_ALL_EMAIL_ACCESS,
				error:
					"EMAIL_ACCESS_ALLOWED_PATTERN is not a valid regular expression, so nobody but admins can sign in",
			};
		}
		return {
			policy: {
				mode: "pattern",
				allowedEmailPattern: pattern,
				allowedDomains: [],
				allowClerkTestEmails,
			},
			error: null,
		};
	}

	if (rawDomains) {
		const allowedDomains = normalizeDomains(rawDomains.split(","));
		if (allowedDomains.length === 0) {
			return {
				policy: DENY_ALL_EMAIL_ACCESS,
				error:
					"EMAIL_ACCESS_ALLOWED_DOMAINS holds no valid domain, so nobody but admins can sign in",
			};
		}
		return {
			policy: { mode: "domains", allowedDomains, allowClerkTestEmails },
			error: null,
		};
	}

	return { policy: null, error: null };
}

export function resolveEmailAccess(
	input: Partial<EmailAccessPolicy> | null | undefined,
): EmailAccessPolicy {
	if (!input) return { ...DEFAULT_EMAIL_ACCESS };

	const allowClerkTestEmails = input.allowClerkTestEmails === true;
	const allowedDomains = normalizeDomains(input.allowedDomains);

	if (input.mode === "domains") {
		// An empty domain list would lock out every non-admin. Treat it as
		// unconfigured rather than as a closed door.
		if (allowedDomains.length === 0) {
			return { mode: "open", allowedDomains: [], allowClerkTestEmails };
		}
		return { mode: "domains", allowedDomains, allowClerkTestEmails };
	}

	if (input.mode === "pattern") {
		if (!isValidEmailPattern(input.allowedEmailPattern)) {
			return { mode: "open", allowedDomains: [], allowClerkTestEmails };
		}
		return {
			mode: "pattern",
			allowedEmailPattern: input.allowedEmailPattern,
			allowedDomains: [],
			allowClerkTestEmails,
		};
	}

	return { mode: "open", allowedDomains: [], allowClerkTestEmails };
}

export function resolveOps(
	input: Partial<OpsSettings> | null | undefined,
): OpsSettings {
	const timezone = input?.defaultTeamTimezone?.trim();
	return {
		retentionDays: clampInteger(
			input?.retentionDays,
			OPS_BOUNDS.retentionDays,
			DEFAULT_OPS.retentionDays,
		),
		assignmentFeedLength: clampInteger(
			input?.assignmentFeedLength,
			OPS_BOUNDS.assignmentFeedLength,
			DEFAULT_OPS.assignmentFeedLength,
		),
		backupsPerTeam: clampInteger(
			input?.backupsPerTeam,
			OPS_BOUNDS.backupsPerTeam,
			DEFAULT_OPS.backupsPerTeam,
		),
		debugMessageLimit: clampInteger(
			input?.debugMessageLimit,
			OPS_BOUNDS.debugMessageLimit,
			DEFAULT_OPS.debugMessageLimit,
		),
		defaultEventDurationMinutes: clampInteger(
			input?.defaultEventDurationMinutes,
			OPS_BOUNDS.defaultEventDurationMinutes,
			DEFAULT_OPS.defaultEventDurationMinutes,
		),
		birthdayNotifyLocalHour: clampInteger(
			input?.birthdayNotifyLocalHour,
			OPS_BOUNDS.birthdayNotifyLocalHour,
			DEFAULT_OPS.birthdayNotifyLocalHour,
		),
		defaultTeamTimezone: timezone && timezone.length > 0 ? timezone : undefined,
	};
}

/**
 * `emailAccessFallback` only applies when NO policy has ever been stored. Once
 * an admin saves one in the console the database wins, otherwise the console
 * would be showing a rule the app is not actually enforcing.
 */
export function resolveAppSettings(
	input: AppSettingsInput,
	{
		emailAccessFallback,
	}: { emailAccessFallback?: EmailAccessPolicy | null } = {},
): ResolvedAppSettings {
	return {
		emailAccess: resolveEmailAccess(
			input?.emailAccess ?? emailAccessFallback ?? null,
		),
		featureToggles: input?.featureToggles ?? {},
		ops: resolveOps(input?.ops),
	};
}
