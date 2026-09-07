import type { EmailAccessPolicy } from "./appSettings";

const CLERK_TEST_EMAIL_SUFFIX = "+clerk_test@example.com";

/**
 * Who may use the app.
 *
 * This used to be a hardcoded `@buk.*` regex, which meant any self-hosted
 * instance rejected every one of its own users with no env escape hatch. The
 * rule now comes from the `appSettings` singleton and is editable from the
 * admin console.
 */

function normalize(email: string | null | undefined): string | null {
	const normalized = email?.trim().toLowerCase();
	return normalized && normalized.length > 0 ? normalized : null;
}

function isClerkTestAlias(normalizedEmail: string): boolean {
	return (
		normalizedEmail.endsWith(CLERK_TEST_EMAIL_SUFFIX) &&
		normalizedEmail.length > CLERK_TEST_EMAIL_SUFFIX.length
	);
}

/** Exact-domain match only: "buk.cl" must not admit "buk.cl.attacker.test". */
function matchesDomain(normalizedEmail: string, domain: string): boolean {
	const at = normalizedEmail.lastIndexOf("@");
	if (at < 1) return false;
	return normalizedEmail.slice(at + 1) === domain;
}

export function isAllowedAppEmail(
	email: string | null | undefined,
	policy: EmailAccessPolicy,
): boolean {
	const normalized = normalize(email);
	if (!normalized) return false;

	if (policy.allowClerkTestEmails && isClerkTestAlias(normalized)) {
		return true;
	}

	switch (policy.mode) {
		case "open":
			return true;
		case "domains":
			return (policy.allowedDomains ?? []).some((domain) =>
				matchesDomain(normalized, domain),
			);
		case "pattern": {
			if (!policy.allowedEmailPattern) return false;
			try {
				return new RegExp(policy.allowedEmailPattern).test(normalized);
			} catch {
				// A malformed stored pattern must not lock everyone out.
				return true;
			}
		}
		default: {
			const _exhaustive: never = policy.mode;
			return _exhaustive;
		}
	}
}

/**
 * The check the UI and the server both use.
 *
 * Admins bypass the policy unconditionally, and deliberately: this is what
 * makes a mistyped domain list recoverable instead of a lockout.
 */
export function canAccessApp({
	email,
	policy,
	isAdmin,
}: {
	email: string | null | undefined;
	policy: EmailAccessPolicy;
	isAdmin: boolean;
}): boolean {
	if (isAdmin) return true;
	return isAllowedAppEmail(email, policy);
}
