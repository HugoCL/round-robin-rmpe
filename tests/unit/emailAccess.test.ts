import assert from "node:assert/strict";
import test from "node:test";
import type { EmailAccessPolicy } from "../../lib/appSettings";
import { canAccessApp, isAllowedAppEmail } from "../../lib/emailAccess";

const OPEN: EmailAccessPolicy = { mode: "open" };
const BUK_DOMAINS: EmailAccessPolicy = {
	mode: "domains",
	allowedDomains: ["buk.cl", "buk.com"],
};

test("open mode admits any well-formed address and still rejects blanks", () => {
	assert.equal(isAllowedAppEmail("anyone@acme.com", OPEN), true);
	assert.equal(isAllowedAppEmail("", OPEN), false);
	assert.equal(isAllowedAppEmail(null, OPEN), false);
	assert.equal(isAllowedAppEmail(undefined, OPEN), false);
	assert.equal(isAllowedAppEmail("   ", OPEN), false);
});

test("domain mode matches exactly and rejects lookalike domains", () => {
	assert.equal(isAllowedAppEmail("dev@buk.cl", BUK_DOMAINS), true);
	assert.equal(isAllowedAppEmail("DEV@BUK.COM", BUK_DOMAINS), true);
	// The regression the old hardcoded regex existed to prevent.
	assert.equal(isAllowedAppEmail("dev@buk.cl.example.com", BUK_DOMAINS), false);
	assert.equal(isAllowedAppEmail("dev@notbuk.cl", BUK_DOMAINS), false);
	assert.equal(isAllowedAppEmail("dev@acme.com", BUK_DOMAINS), false);
	assert.equal(isAllowedAppEmail("no-at-sign", BUK_DOMAINS), false);
	assert.equal(isAllowedAppEmail("@buk.cl", BUK_DOMAINS), false);
});

test("pattern mode applies the stored regex, and a broken one does not lock anyone out", () => {
	const policy: EmailAccessPolicy = {
		mode: "pattern",
		allowedEmailPattern: "^.+@(acme|acme-labs)\\.com$",
	};
	assert.equal(isAllowedAppEmail("dev@acme.com", policy), true);
	assert.equal(isAllowedAppEmail("dev@acme-labs.com", policy), true);
	assert.equal(isAllowedAppEmail("dev@other.com", policy), false);

	// A malformed pattern can only reach here from a hand-edited row; failing
	// open beats locking every user out of their own instance.
	assert.equal(
		isAllowedAppEmail("dev@acme.com", {
			mode: "pattern",
			allowedEmailPattern: "(",
		}),
		true,
	);
	assert.equal(isAllowedAppEmail("dev@acme.com", { mode: "pattern" }), false);
});

test("allows only exact Clerk test aliases when explicitly enabled", () => {
	const email = "la-lista+clerk_test@example.com";
	assert.equal(isAllowedAppEmail(email, BUK_DOMAINS), false);
	assert.equal(
		isAllowedAppEmail(email, { ...BUK_DOMAINS, allowClerkTestEmails: true }),
		true,
	);
	assert.equal(
		isAllowedAppEmail("+clerk_test@example.com", {
			...BUK_DOMAINS,
			allowClerkTestEmails: true,
		}),
		false,
	);
	assert.equal(
		isAllowedAppEmail("la-lista+clerk_test@example.com.attacker.test", {
			...BUK_DOMAINS,
			allowClerkTestEmails: true,
		}),
		false,
	);
});

test("admins bypass the policy unconditionally, which is what makes a typo recoverable", () => {
	const locked: EmailAccessPolicy = {
		mode: "domains",
		allowedDomains: ["typo.example"],
	};
	assert.equal(
		canAccessApp({ email: "owner@acme.com", policy: locked, isAdmin: true }),
		true,
	);
	assert.equal(
		canAccessApp({ email: "owner@acme.com", policy: locked, isAdmin: false }),
		false,
	);
	// The bypass is not a blank cheque: an admin with no resolvable email is
	// still an admin, but a non-admin blank is still rejected.
	assert.equal(
		canAccessApp({ email: null, policy: OPEN, isAdmin: false }),
		false,
	);
});
