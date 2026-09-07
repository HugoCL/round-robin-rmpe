import assert from "node:assert/strict";
import test from "node:test";
import {
	APP_FEATURE_KEYS,
	isAppFeatureKey,
	mergeFeatureStates,
	type RequirementScope,
	resolveAllFeatureStates,
	resolveFeatureState,
} from "../../lib/appFeatures";
import {
	clampInteger,
	DEFAULT_OPS,
	type EmailAccessPolicy,
	isValidEmailPattern,
	MAX_EMAIL_PATTERN_LENGTH,
	normalizeDomain,
	normalizeDomains,
	parseEmailAccessEnv,
	resolveAppSettings,
	resolveEmailAccess,
	resolveOps,
} from "../../lib/appSettings";
import { canAccessApp, isAllowedAppEmail } from "../../lib/emailAccess";

test("clampInteger bounds values and rejects non-finite input", () => {
	const bounds = { min: 1, max: 10 };
	assert.equal(clampInteger(5, bounds, 3), 5);
	assert.equal(clampInteger(0, bounds, 3), 1);
	assert.equal(clampInteger(99, bounds, 3), 10);
	assert.equal(clampInteger(4.6, bounds, 3), 5);
	assert.equal(clampInteger(Number.NaN, bounds, 3), 3);
	assert.equal(clampInteger(Number.POSITIVE_INFINITY, bounds, 3), 3);
	assert.equal(clampInteger(undefined, bounds, 3), 3);
	assert.equal(clampInteger(null, bounds, 3), 3);
});

test("normalizeDomain lowercases, strips @, and rejects malformed input", () => {
	assert.equal(normalizeDomain("  @Buk.CL "), "buk.cl");
	assert.equal(normalizeDomain("acme.co.uk"), "acme.co.uk");
	assert.equal(normalizeDomain("localhost"), null);
	assert.equal(normalizeDomain(""), null);
	assert.equal(normalizeDomain("-bad.com"), null);
	assert.equal(normalizeDomain("has space.com"), null);
});

test("normalizeDomains dedupes, drops invalid entries, and sorts", () => {
	assert.deepEqual(
		normalizeDomains(["@Acme.com", "acme.com", "not a domain", "buk.cl"]),
		["acme.com", "buk.cl"],
	);
	assert.deepEqual(normalizeDomains(undefined), []);
});

test("isValidEmailPattern rejects invalid regexes and over-long patterns", () => {
	assert.equal(isValidEmailPattern("^.+@acme\\.com$"), true);
	assert.equal(isValidEmailPattern("("), false);
	assert.equal(isValidEmailPattern(""), false);
	assert.equal(isValidEmailPattern(undefined), false);
	assert.equal(
		isValidEmailPattern("a".repeat(MAX_EMAIL_PATTERN_LENGTH + 1)),
		false,
	);
});

test("resolveEmailAccess falls back to open when a mode is unusable", () => {
	// An empty domain list would lock out every non-admin, so it is treated as
	// unconfigured rather than as a closed door.
	assert.equal(
		resolveEmailAccess({ mode: "domains", allowedDomains: [] }).mode,
		"open",
	);
	assert.equal(
		resolveEmailAccess({ mode: "domains", allowedDomains: ["nope"] }).mode,
		"open",
	);
	assert.equal(
		resolveEmailAccess({ mode: "pattern", allowedEmailPattern: "(" }).mode,
		"open",
	);
	assert.equal(resolveEmailAccess(null).mode, "open");
	assert.equal(resolveEmailAccess(undefined).mode, "open");
});

test("resolveEmailAccess keeps valid configuration and normalizes domains", () => {
	const resolved = resolveEmailAccess({
		mode: "domains",
		allowedDomains: ["@ACME.com", "acme.com", "buk.cl"],
		allowClerkTestEmails: true,
	});
	assert.equal(resolved.mode, "domains");
	assert.deepEqual(resolved.allowedDomains, ["acme.com", "buk.cl"]);
	assert.equal(resolved.allowClerkTestEmails, true);

	const pattern = resolveEmailAccess({
		mode: "pattern",
		allowedEmailPattern: "^.+@acme\\.com$",
	});
	assert.equal(pattern.mode, "pattern");
	assert.equal(pattern.allowedEmailPattern, "^.+@acme\\.com$");
	assert.equal(pattern.allowClerkTestEmails, false);
});

test("resolveOps clamps every knob and defaults an absent row", () => {
	assert.deepEqual(resolveOps(undefined), {
		...DEFAULT_OPS,
		defaultTeamTimezone: undefined,
	});

	const clamped = resolveOps({
		retentionDays: 100000,
		assignmentFeedLength: 0,
		backupsPerTeam: -5,
		debugMessageLimit: 999,
		defaultEventDurationMinutes: 1,
		birthdayNotifyLocalHour: 47,
		defaultTeamTimezone: "  ",
	});
	assert.equal(clamped.retentionDays, 365);
	assert.equal(clamped.assignmentFeedLength, 1);
	assert.equal(clamped.backupsPerTeam, 1);
	assert.equal(clamped.debugMessageLimit, 200);
	assert.equal(clamped.defaultEventDurationMinutes, 5);
	assert.equal(clamped.birthdayNotifyLocalHour, 23);
	assert.equal(clamped.defaultTeamTimezone, undefined);

	assert.equal(
		resolveOps({ defaultTeamTimezone: " Europe/Madrid " }).defaultTeamTimezone,
		"Europe/Madrid",
	);
});

test("resolveAppSettings reproduces prior hardcoded behaviour for an absent row", () => {
	const resolved = resolveAppSettings(null);
	assert.equal(resolved.emailAccess.mode, "open");
	assert.deepEqual(resolved.featureToggles, {});
	assert.equal(resolved.ops.retentionDays, 7);
	assert.equal(resolved.ops.assignmentFeedLength, 5);
	assert.equal(resolved.ops.debugMessageLimit, 3);
	assert.equal(resolved.ops.birthdayNotifyLocalHour, 9);
	assert.equal(resolved.ops.defaultEventDurationMinutes, 20);
	assert.equal(resolved.ops.backupsPerTeam, 20);
});

test("resolveFeatureState separates admin intent from missing requirements", () => {
	const definition = {
		key: "pushNotifications",
		defaultEnabled: true,
		requirements: [
			{ envVar: "VAPID_PRIVATE_KEY", scope: "convex" as const },
			{ envVar: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", scope: "convex" as const },
		],
	};
	const convexScope = new Set<RequirementScope>(["convex"]);

	// Toggle on, keys present: enabled.
	const healthy = resolveFeatureState(
		definition,
		{},
		new Set(["VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"]),
		{ scopes: convexScope },
	);
	assert.equal(healthy.enabled, true);
	assert.deepEqual(healthy.missingRequirements, []);

	// Toggle on, a key missing: intent preserved, feature off.
	const unsatisfied = resolveFeatureState(
		definition,
		{ pushNotifications: true },
		new Set(["VAPID_PRIVATE_KEY"]),
		{ scopes: convexScope },
	);
	assert.equal(unsatisfied.toggle, true);
	assert.equal(unsatisfied.requirementsMet, false);
	assert.equal(unsatisfied.enabled, false);
	assert.deepEqual(unsatisfied.missingRequirements, [
		"NEXT_PUBLIC_VAPID_PUBLIC_KEY",
	]);

	// Toggle off with keys present: still off.
	const disabled = resolveFeatureState(
		definition,
		{ pushNotifications: false },
		new Set(["VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"]),
		{ scopes: convexScope },
	);
	assert.equal(disabled.enabled, false);
	assert.equal(disabled.requirementsMet, true);
});

test("a caller only judges requirements in scopes it can observe", () => {
	const definition = {
		key: "aiChatDrafting",
		defaultEnabled: true,
		requirements: [
			{ envVar: "GOOGLE_GENERATIVE_AI_API_KEY", scope: "web" as const },
		],
	};
	// Convex cannot see web-side env vars, so it must not report them missing.
	const fromConvex = resolveFeatureState(definition, {}, new Set(), {
		scopes: new Set<RequirementScope>(["convex"]),
	});
	assert.equal(fromConvex.enabled, true);
	assert.deepEqual(fromConvex.missingRequirements, []);

	const fromWeb = resolveFeatureState(definition, {}, new Set(), {
		scopes: new Set<RequirementScope>(["web"]),
	});
	assert.equal(fromWeb.enabled, false);
	assert.deepEqual(fromWeb.missingRequirements, [
		"GOOGLE_GENERATIVE_AI_API_KEY",
	]);
});

test("mergeFeatureStates folds web-side gaps into the Convex view", () => {
	const convexStates = resolveAllFeatureStates({}, new Set(), {
		scopes: new Set<RequirementScope>(["convex"]),
	});
	const merged = mergeFeatureStates(
		convexStates,
		new Set(["GOOGLE_GENERATIVE_AI_API_KEY"]),
	);
	assert.equal(merged.aiChatDrafting.enabled, false);
	assert.deepEqual(merged.aiChatDrafting.missingRequirements, [
		"GOOGLE_GENERATIVE_AI_API_KEY",
	]);
	// Features with no web requirement are untouched.
	assert.equal(merged.events.enabled, true);
});

test("the feature registry is the only source of valid toggle keys", () => {
	assert.equal(isAppFeatureKey("events"), true);
	assert.equal(isAppFeatureKey("notAFeature"), false);
	assert.equal(APP_FEATURE_KEYS.length, new Set(APP_FEATURE_KEYS).size);
});

test("parseEmailAccessEnv says nothing when the environment says nothing", () => {
	assert.deepEqual(parseEmailAccessEnv({}), { policy: null, error: null });
	assert.deepEqual(parseEmailAccessEnv({ domains: "  ", pattern: "" }), {
		policy: null,
		error: null,
	});
});

test("parseEmailAccessEnv reads a domain list", () => {
	const { policy, error } = parseEmailAccessEnv({
		domains: " Buk.cl, @buk.com , buk.cl ",
	});
	assert.equal(error, null);
	assert.deepEqual(policy, {
		mode: "domains",
		allowedDomains: ["buk.cl", "buk.com"],
		allowClerkTestEmails: false,
	});
});

test("parseEmailAccessEnv prefers the pattern when both are set", () => {
	const { policy } = parseEmailAccessEnv({
		domains: "acme.com",
		pattern: "^.+@buk\\.[a-z0-9-]+$",
		allowClerkTestEmails: "true",
	});
	assert.equal(policy?.mode, "pattern");
	assert.equal(policy?.allowedEmailPattern, "^.+@buk\\.[a-z0-9-]+$");
	assert.equal(policy?.allowClerkTestEmails, true);
});

test("an unparseable environment policy denies rather than opens", () => {
	const badPattern = parseEmailAccessEnv({ pattern: "^(unclosed" });
	assert.ok(badPattern.error);
	assert.equal(
		isAllowedAppEmail("anyone@buk.cl", badPattern.policy as EmailAccessPolicy),
		false,
	);

	const badDomains = parseEmailAccessEnv({ domains: "not a domain, @@@" });
	assert.ok(badDomains.error);
	assert.equal(
		isAllowedAppEmail("anyone@buk.cl", badDomains.policy as EmailAccessPolicy),
		false,
	);

	// Admins still get in, which is what keeps a typo recoverable.
	assert.equal(
		canAccessApp({
			email: "ops@buk.cl",
			policy: badPattern.policy as EmailAccessPolicy,
			isAdmin: true,
		}),
		true,
	);
});

test("the environment policy applies only until one is stored", () => {
	const fromEnv = parseEmailAccessEnv({ domains: "buk.cl" }).policy;

	// No row at all: the environment decides.
	assert.deepEqual(
		resolveAppSettings(null, { emailAccessFallback: fromEnv }).emailAccess.mode,
		"domains",
	);

	// A row exists but has never had a policy saved: still the environment.
	assert.equal(
		resolveAppSettings(
			{ ops: { retentionDays: 3 } },
			{
				emailAccessFallback: fromEnv,
			},
		).emailAccess.mode,
		"domains",
	);

	// A saved policy wins, even when it is more permissive than the env one.
	assert.equal(
		resolveAppSettings(
			{ emailAccess: { mode: "open" } },
			{ emailAccessFallback: fromEnv },
		).emailAccess.mode,
		"open",
	);
});
