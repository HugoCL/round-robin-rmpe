import assert from "node:assert/strict";
import test from "node:test";
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "../../lib/sentry/options";

type Envelope = [Record<string, unknown>, unknown[]];

const envelopes: Envelope[] = [];

// A second init in the same process sent nothing here, so init once.
Sentry.init({
	dsn: "https://public@example.invalid/1",
	...sentryOptions,
	tracesSampleRate: 1,
	defaultIntegrations: false,
	transport: () => ({
		send: async (envelope: unknown) => {
			envelopes.push(envelope as Envelope);
			return {};
		},
		flush: async () => true,
	}),
});

test("streamed spans reach the transport with emails and identity removed", async () => {
	envelopes.length = 0;

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

	const items = envelopes.flatMap(([, envelopeItems]) => envelopeItems);
	const payload = JSON.stringify(items);
	assert.ok(payload.includes("app.step"), "span was sent");
	assert.ok(payload.includes("[email]"), "emails redacted");
	assert.ok(!payload.includes("example.com"), "no address survives");
	assert.ok(!payload.includes("example.org"), "no encoded address survives");
	assert.ok(!payload.includes("203.0.113.7"), "ip dropped");
});

test("class instances used as span attributes never reach the transport", async () => {
	class Contact {
		value = "ana@example.com";
	}
	envelopes.length = 0;

	Sentry.startSpan(
		{
			name: "assign",
			attributes: {
				contact: new Contact() as never,
				contacts: [new Contact()] as never,
				"app.step": "assign",
			},
		},
		() => {},
	);
	await Sentry.flush(2000);

	const payload = JSON.stringify(envelopes);
	assert.ok(payload.includes("app.step"), "span was sent");
	assert.ok(!payload.includes("ana@example.com"), "no address survives");
	assert.ok(!payload.includes("example.com"), "no domain survives");
});

test("a root span name with an email is scrubbed from the trace header and baggage", async () => {
	envelopes.length = 0;
	let baggage = "";
	let sentryTrace = "";

	Sentry.startSpan({ name: "GET /team/ana.perez@example.com" }, () => {
		const traceData = Sentry.getTraceData();
		baggage = traceData.baggage ?? "";
		sentryTrace = traceData["sentry-trace"] ?? "";
	});
	await Sentry.flush(2000);

	const headers = envelopes.map(([header]) => header);
	const traces = headers.flatMap((header) => header.trace ?? []);
	assert.ok(traces.length > 0, "an envelope carried a trace header");
	assert.deepEqual(
		traces.map((trace) => (trace as { transaction?: string }).transaction),
		traces.map(() => "GET /team/[email]"),
	);
	assert.ok(sentryTrace.length > 0, "trace data was produced");
	assert.ok(baggage.includes("sentry-transaction="), "baggage has a name");
	assert.ok(!baggage.includes("example.com"), "baggage has no address");
	assert.ok(!baggage.includes("example%2Ecom"), "baggage has no encoded one");
	assert.ok(
		!JSON.stringify(headers).includes("example.com"),
		"no envelope header has an address",
	);
});
