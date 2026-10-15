import assert from "node:assert/strict";
import test from "node:test";
import type { Event } from "@sentry/nextjs";
import { scrubEvent } from "../../lib/sentry/scrubEvent";

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

test("returns an event without user or request when scrubbing throws", () => {
	const hostile = new Proxy(
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
		extra: { hostile },
	};

	assert.deepEqual(scrubEvent(event), {
		message: "ana@example.com",
		extra: { hostile },
	});
});
