import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedAppEmail } from "../../lib/emailAccess";

test("allows Buk emails and rejects lookalike domains", () => {
	assert.equal(isAllowedAppEmail("dev@buk.cl"), true);
	assert.equal(isAllowedAppEmail("DEV@BUK.COM"), true);
	assert.equal(isAllowedAppEmail("dev@buk.cl.example.com"), false);
});

test("allows only exact Clerk test aliases when explicitly enabled", () => {
	const email = "la-lista+clerk_test@example.com";
	assert.equal(isAllowedAppEmail(email), false);
	assert.equal(isAllowedAppEmail(email, true), true);
	assert.equal(isAllowedAppEmail("+clerk_test@example.com", true), false);
	assert.equal(
		isAllowedAppEmail("la-lista+clerk_test@example.com.attacker.test", true),
		false,
	);
});
