import assert from "node:assert/strict";
import test from "node:test";
import {
	collectUnverifiedSessionReport,
	consumeRetryCount,
	formatUnverifiedSessionLog,
	SESSION_UNVERIFIED_RETRY_KEY,
	type UnverifiedSessionReport,
} from "../../lib/sessionUnverifiedReport";

const base = {
	clientTimestamp: 1_700_000_000_000,
	route: "/es/platform",
	userAgent: "TestAgent",
	retryCount: 0,
};

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
	};
}

function fakeJwt(payload: Record<string, unknown>): string {
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `eyJhbGciOiJIUzI1NiJ9.${body}.signature-must-stay-out-of-the-report`;
}

function parseLog(line: string) {
	assert.equal(line.startsWith("[sessionUnverified] "), true);
	return JSON.parse(line.slice("[sessionUnverified] ".length)) as {
		skewMs: number | null;
		clockSkewSuspected: boolean | null;
		serverNow: number;
		tokenExpired: boolean | null;
		iatInFuture: boolean | null;
		retryCount: number;
		iss: string | null;
		tokenError: string | null;
		route: string;
	};
}

test("a convex token contributes claims and nothing else", async () => {
	const token = fakeJwt({
		iss: "https://tidy-stingray-81.clerk.accounts.dev",
		aud: "convex",
		iat: 10,
		exp: 70,
		sub: "user_secret_subject",
	});
	const report = await collectUnverifiedSessionReport({
		...base,
		getToken: async () => token,
		clerkUserId: "user_123",
		clerkEmail: "ada@example.com",
	});

	assert.equal(report.tokenStatus, "present");
	assert.equal(report.iss, "https://tidy-stingray-81.clerk.accounts.dev");
	assert.equal(report.aud, "convex");
	assert.equal(report.iat, 10);
	assert.equal(report.exp, 70);
	assert.equal(report.clerkUserId, "user_123");
	assert.equal(report.clerkEmail, "ada@example.com");
	const serialized = JSON.stringify(report);
	assert.equal(serialized.includes(token), false);
	assert.equal(serialized.includes("signature-must-stay-out"), false);
	assert.equal(serialized.includes("user_secret_subject"), false);
});

test("an audience array is joined and a missing token stays missing", async () => {
	const present = await collectUnverifiedSessionReport({
		...base,
		getToken: async () =>
			fakeJwt({ aud: ["convex", "extra"], iss: "https://issuer.example" }),
	});
	assert.equal(present.aud, "convex,extra");

	const missing = await collectUnverifiedSessionReport({
		...base,
		getToken: async () => null,
	});
	assert.equal(missing.tokenStatus, "missing");
	assert.equal(missing.iss, undefined);
	assert.equal(missing.tokenError, undefined);
});

test("a getToken failure keeps the message and drops any jwt inside it", async () => {
	const token = fakeJwt({ iss: "https://issuer.example" });
	const report = await collectUnverifiedSessionReport({
		...base,
		getToken: async () => {
			throw new Error(`No JWT template ${token}`);
		},
	});
	assert.equal(report.tokenStatus, "error");
	assert.match(report.tokenError ?? "", /No JWT template \[redacted\]/);
	assert.equal(JSON.stringify(report).includes(token), false);
});

test("an undecodable token is reported without the raw value", async () => {
	const report = await collectUnverifiedSessionReport({
		...base,
		getToken: async () => "not-a-jwt",
	});
	assert.equal(report.tokenStatus, "present");
	assert.equal(report.tokenError, "Could not decode token payload");
	assert.equal(JSON.stringify(report).includes("not-a-jwt"), false);
});

test("the server line compares the client clock and the token lifetime", () => {
	const report: UnverifiedSessionReport = {
		...base,
		clientTimestamp: 1_000,
		tokenStatus: "present",
		iss: "https://tidy-stingray-81.clerk.accounts.dev",
		iat: 1,
		exp: 2,
		retryCount: 3,
	};
	const body = parseLog(formatUnverifiedSessionLog(report, 70_000));
	assert.equal(body.serverNow, 70_000);
	assert.equal(body.skewMs, 69_000);
	assert.equal(body.clockSkewSuspected, true);
	assert.equal(body.tokenExpired, true);
	assert.equal(body.iatInFuture, false);
	assert.equal(body.retryCount, 3);
	assert.equal(body.iss, "https://tidy-stingray-81.clerk.accounts.dev");
});

test("a jwt that slips into another field is scrubbed before the log line", () => {
	const token = fakeJwt({ iss: "https://issuer.example" });
	const line = formatUnverifiedSessionLog(
		{
			...base,
			tokenStatus: "error",
			route: `/es?__clerk_db_jwt=${token}`,
			tokenError: token,
		},
		base.clientTimestamp,
	);
	assert.equal(line.includes(token), false);
	assert.equal(line.includes("signature-must-stay-out"), false);
	const body = parseLog(line);
	assert.match(body.route, /__clerk_db_jwt=\[redacted\]/);
	assert.equal(body.tokenError, "[redacted]");
	assert.equal(body.clockSkewSuspected, false);
});

test("retry count advances once per display and survives a storage failure", () => {
	const storage = memoryStorage();
	assert.equal(consumeRetryCount(storage), 0);
	assert.equal(storage.getItem(SESSION_UNVERIFIED_RETRY_KEY), "1");
	assert.equal(consumeRetryCount(storage), 1);
	assert.equal(consumeRetryCount(storage), 2);
	assert.equal(
		consumeRetryCount({
			getItem() {
				throw new Error("blocked");
			},
			setItem() {
				throw new Error("blocked");
			},
		}),
		0,
	);
});
