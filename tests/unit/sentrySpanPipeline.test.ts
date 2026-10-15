import assert from "node:assert/strict";
import test from "node:test";
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "../../lib/sentry/options";

test("streamed spans reach the transport with emails and identity removed", async () => {
	const envelopes: unknown[] = [];
	Sentry.init({
		dsn: "https://public@example.invalid/1",
		...sentryOptions,
		tracesSampleRate: 1,
		defaultIntegrations: false,
		transport: () => ({
			send: async (envelope: unknown) => {
				envelopes.push(envelope);
				return {};
			},
			flush: async () => true,
		}),
	});

	Sentry.startSpan(
		{
			name: "GET /team/ana.perez@example.com",
			attributes: {
				"url.full": "https://app.example.test/team?owner=bob%40example.org",
				"user.email": "ana.perez@example.com",
				"client.address": "203.0.113.7",
				"app.step": "assign",
			},
		},
		() => {},
	);
	await Sentry.flush(2000);

	const items = (envelopes as [unknown, unknown[]][]).flatMap(
		([, envelopeItems]) => envelopeItems,
	);
	const payload = JSON.stringify(items);
	assert.ok(payload.includes("app.step"), "span was sent");
	assert.ok(payload.includes("[email]"), "emails redacted");
	assert.ok(!payload.includes("example.com"), "no address survives");
	assert.ok(!payload.includes("example.org"), "no encoded address survives");
	assert.ok(!payload.includes("203.0.113.7"), "ip dropped");
});
