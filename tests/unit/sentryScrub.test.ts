import assert from "node:assert/strict";
import test from "node:test";
import type { Event } from "@sentry/nextjs";
import { scrubEvent, scrubSpan } from "../../lib/sentry/scrubEvent";

test("strips identity, credentials and email addresses from an event", () => {
	const event: Event = {
		message: "Could not load team for ana.perez@example.com",
		user: {
			id: "user_2abc",
			email: "ana.perez@example.com",
			ip_address: "203.0.113.7",
			username: "ana",
		},
		request: {
			url: "https://app.example.test/es/team?invite=ana.perez%40example.com",
			query_string: "owner=bob@example.org&page=2",
			cookies: { __session: "jwt" },
			data: { email: "ana.perez@example.com" },
			headers: {
				Authorization: "Bearer secret",
				Cookie: "__session=jwt",
				"X-Clerk-Auth-Status": "signed-in",
				"User-Agent": "Mozilla/5.0",
				Accept: "text/html",
			},
		},
		exception: {
			values: [
				{
					type: "Error",
					value: "Reviewer carla@example.com is not on the team",
				},
			],
		},
		breadcrumbs: [
			{
				category: "console",
				message: "assigning dan@example.net",
				data: { to: "dan@example.net", count: 3 },
			},
		],
		extra: { reviewers: ["eve@example.com", "plain text"] },
		contexts: {
			assignment: { owner: { contact: "frank@example.com" }, id: 42 },
		},
		tags: { route: "/es/team" },
	};

	assert.deepEqual(scrubEvent(event), {
		message: "Could not load team for [email]",
		request: {
			url: "https://app.example.test/es/team?invite=[email]",
			query_string: "owner=[email]&page=2",
			headers: {
				"User-Agent": "Mozilla/5.0",
				Accept: "text/html",
			},
		},
		exception: {
			values: [
				{
					type: "Error",
					value: "Reviewer [email] is not on the team",
				},
			],
		},
		breadcrumbs: [
			{
				category: "console",
				message: "assigning [email]",
				data: { to: "[email]", count: 3 },
			},
		],
		extra: { reviewers: ["[email]", "plain text"] },
		contexts: {
			assignment: { owner: { contact: "[email]" }, id: 42 },
		},
		tags: { route: "/es/team" },
	});
});

test("leaves strings without an email address untouched", () => {
	const event: Event = {
		message: "Rate limited at 10@5 req/s for team alpha",
		extra: { handle: "@ana", path: "/api/v1/assign" },
	};

	assert.deepEqual(scrubEvent(event), {
		message: "Rate limited at 10@5 req/s for team alpha",
		extra: { handle: "@ana", path: "/api/v1/assign" },
	});
});

test("does not mutate the input event", () => {
	const event: Event = {
		message: "ana@example.com",
		user: { id: "user_1" },
	};

	scrubEvent(event);

	assert.deepEqual(event, {
		message: "ana@example.com",
		user: { id: "user_1" },
	});
});

test("survives circular references and still returns the event", () => {
	const extra: Record<string, unknown> = { owner: "gus@example.com" };
	extra.self = extra;
	const event: Event = { message: "boom", extra };

	assert.deepEqual(scrubEvent(event), {
		message: "boom",
		extra: { owner: "[email]", self: "[Circular]" },
	});
});

test("redacts encoded addresses and quoted local parts exactly", () => {
	const event: Event = {
		message:
			"a ana%40example%2Ecom b ana%40example%2ecom c o'brien@example.com",
		extra: {
			plus: "ana%2Bteam@example.com",
			path: "/es/team?owner=bob@example.org&page=2",
		},
	};

	assert.deepEqual(scrubEvent(event), {
		message: "a [email] b [email] c [email]",
		extra: { plus: "[email]", path: "/es/team?owner=[email]&page=2" },
	});
});

test("does not redact strings that only look like addresses", () => {
	const event: Event = {
		message: "10@5 @ana user@localhost react@19.1.0 100%40 done",
	};

	assert.deepEqual(scrubEvent(event), {
		message: "10@5 @ana user@localhost react@19.1.0 100%40 done",
	});
});

test("omits properties that throw and keeps redacting the rest", () => {
	const throwingGetter = {
		owner: "ana@example.com",
		get secret(): string {
			throw new Error("getter");
		},
	};
	const hostileProxy = new Proxy(
		{},
		{
			ownKeys() {
				throw new Error("hostile");
			},
		},
	);
	const event: Event = {
		message: "ana@example.com",
		user: { id: "user_1" },
		request: { url: "https://app.example.test/" },
		extra: {
			throwingGetter,
			hostileProxy,
			list: [hostileProxy, "bob@example.org"],
		},
	};

	assert.deepEqual(scrubEvent(event), {
		message: "[email]",
		request: { url: "https://app.example.test/" },
		extra: { throwingGetter: { owner: "[email]" }, list: ["[email]"] },
	});
});

test("truncates nesting deeper than the limit without overflowing the stack", () => {
	let deepest: Record<string, unknown> = { leaf: "ana@example.com" };
	for (let i = 0; i < 5000; i++) deepest = { next: deepest };
	const scrubbed = scrubEvent({ message: "boom", extra: deepest } as Event);

	let node: unknown = scrubbed.extra;
	let depth = 0;
	while (typeof node === "object" && node !== null) {
		node = (node as Record<string, unknown>).next;
		depth++;
	}
	assert.equal(node, "[Truncated]");
	assert.equal(depth, 19);
	assert.equal(scrubbed.message, "boom");
});

test("returns a minimal event with no user data when the walk cannot start", () => {
	const hostile = new Proxy(
		{ event_id: "abc123", level: "error", message: "ana@example.com" },
		{
			ownKeys() {
				throw new Error("hostile");
			},
		},
	) as Event;

	assert.deepEqual(scrubEvent(hostile), {
		event_id: "abc123",
		level: "error",
		message: "[event dropped by privacy scrubber]",
	});
});

test("scrubs a streamed span's name, attributes and links", () => {
	const span = {
		trace_id: "c9bc5fc9ccce44c2aa6723096581478b",
		span_id: "a299d7251c3ecc78",
		name: "GET /team/ana@example.com",
		start_timestamp: 1,
		end_timestamp: 2,
		status: "ok" as const,
		is_segment: true,
		attributes: {
			"url.full": {
				value: "https://app.example.test/?o=bob%40example.org",
				type: "string",
			},
			"http.query": "owner=carl@example.net&page=2",
			"user.id": "user_1",
			"user.email": "ana@example.com",
			"sentry.user.ip": "203.0.113.7",
			"client.address": "203.0.113.7",
			"http.client_ip": "203.0.113.7",
			"http.request.header.cookie": "__session=jwt",
			"http.request.header.accept": "text/html",
			"app.step": "assign",
		},
		links: [
			{
				trace_id: "c9bc5fc9ccce44c2aa6723096581478b",
				span_id: "b299d7251c3ecc78",
				attributes: { who: "dan@example.com" },
			},
		],
	};

	assert.deepEqual(scrubSpan(span), {
		trace_id: "c9bc5fc9ccce44c2aa6723096581478b",
		span_id: "a299d7251c3ecc78",
		name: "GET /team/[email]",
		start_timestamp: 1,
		end_timestamp: 2,
		status: "ok",
		is_segment: true,
		attributes: {
			"url.full": {
				value: "https://app.example.test/?o=[email]",
				type: "string",
			},
			"http.query": "owner=[email]&page=2",
			"http.request.header.accept": "text/html",
			"app.step": "assign",
		},
		links: [
			{
				trace_id: "c9bc5fc9ccce44c2aa6723096581478b",
				span_id: "b299d7251c3ecc78",
				attributes: { who: "[email]" },
			},
		],
	});
});

test("returns a span without user data when span scrubbing throws", () => {
	const span = {
		trace_id: "c9bc5fc9ccce44c2aa6723096581478b",
		span_id: "a299d7251c3ecc78",
		name: "GET /team/ana@example.com",
		start_timestamp: 1,
		end_timestamp: 2,
		status: "ok" as const,
		is_segment: true,
		attributes: new Proxy(
			{},
			{
				ownKeys() {
					throw new Error("hostile");
				},
			},
		),
	};

	assert.deepEqual(scrubSpan(span), {
		trace_id: "c9bc5fc9ccce44c2aa6723096581478b",
		span_id: "a299d7251c3ecc78",
		start_timestamp: 1,
		end_timestamp: 2,
		status: "ok",
		is_segment: true,
		name: "[event dropped by privacy scrubber]",
		attributes: {},
	});
});
