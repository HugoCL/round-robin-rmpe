import assert from "node:assert/strict";
import test from "node:test";
import {
	type ChatWebhookTarget,
	deliverChatMessageToTargets,
	describeChatDeliveryProblems,
	describePartialChatDelivery,
	prependOriginTeamNotice,
	resolveBroadcastTeamSlugs,
	resolveNotifiedTeamSlugs,
	withGoogleChatMessageReplyOption,
} from "../../lib/chatBroadcast";

const sourceTarget: ChatWebhookTarget = {
	slug: "platform",
	name: "Platform",
	webhookUrl: "https://chat.example.com/platform",
	isExternalTarget: false,
};

const receivingTarget: ChatWebhookTarget = {
	slug: "payments",
	name: "Payments",
	webhookUrl: "https://chat.example.com/payments",
	isExternalTarget: true,
};

type FetchCall = { url: string; body: string };

function stubFetch(responder: (url: string) => Response): {
	calls: FetchCall[];
	restore: () => void;
} {
	const calls: FetchCall[] = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, body: String(init?.body ?? "") });
		return responder(url);
	}) as typeof globalThis.fetch;
	return {
		calls,
		restore: () => {
			globalThis.fetch = originalFetch;
		},
	};
}

function deliver(targets: ChatWebhookTarget[]) {
	return deliverChatMessageToTargets({
		targets,
		baseMessage: "Hola equipo",
		sourceTeamName: "Platform",
		locale: "es",
		prUrl: "https://github.com/org/repo/pull/12",
		urgent: false,
		cardId: "pr-assignment-card",
	});
}

test("broadcasts to the receiving team when a PR is assigned across teams", () => {
	assert.deepEqual(
		resolveBroadcastTeamSlugs({
			sourceTeamSlug: "platform",
			reviewerTeamSlugs: ["payments"],
		}),
		["payments"],
	);
});

test("notifies both the sending and the receiving team channel", () => {
	assert.deepEqual(
		resolveNotifiedTeamSlugs({
			sourceTeamSlug: "platform",
			reviewerTeamSlugs: ["payments", "payments", "growth"],
		}),
		["platform", "payments", "growth"],
	);
});

test("does not broadcast for same-team assignments", () => {
	assert.deepEqual(
		resolveBroadcastTeamSlugs({
			sourceTeamSlug: "platform",
			reviewerTeamSlugs: ["platform", " platform ", undefined, null, ""],
		}),
		[],
	);
	assert.deepEqual(
		resolveNotifiedTeamSlugs({
			sourceTeamSlug: "platform",
			reviewerTeamSlugs: ["platform"],
		}),
		["platform"],
	);
});

test("ignores teams that were only candidates and never got a reviewer", () => {
	// growth was in the candidate pool but no reviewer came from it.
	assert.deepEqual(
		resolveBroadcastTeamSlugs({
			sourceTeamSlug: "platform",
			reviewerTeamSlugs: [undefined, "payments"],
		}),
		["payments"],
	);
});

test("reports which team channels missed the message", () => {
	assert.equal(
		describeChatDeliveryProblems(["payments: HTTP 500 Server Error"], []),
		"payments: HTTP 500 Server Error",
	);
	assert.equal(
		describeChatDeliveryProblems([], ["payments"]),
		"payments: Google Chat webhook URL not configured",
	);
	assert.equal(describeChatDeliveryProblems([], []), undefined);
	assert.equal(
		describePartialChatDelivery(["platform"], "payments: HTTP 404 Not Found"),
		"Sent to platform but failed for payments: HTTP 404 Not Found",
	);
});

test("sends the assignment to both the sending and the receiving channel", async () => {
	const fetchStub = stubFetch((url) => {
		const space = url.includes("/platform") ? "AAA" : "CCC";
		const message = url.includes("/platform") ? "BBB" : "DDD";
		return new Response(
			JSON.stringify({ name: `spaces/${space}/messages/${message}` }),
			{ status: 200 },
		);
	});
	try {
		const delivery = await deliver([sourceTarget, receivingTarget]);
		assert.deepEqual(delivery.deliveredSlugs, ["platform", "payments"]);
		assert.deepEqual(delivery.failures, []);
		assert.deepEqual(
			fetchStub.calls.map((call) => call.url),
			[
				"https://chat.example.com/platform?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD",
				"https://chat.example.com/payments?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD",
			],
		);
		assert.equal(
			delivery.googleChatThreadUrl,
			"https://chat.google.com/room/AAA/BBB",
		);
		assert.deepEqual(delivery.googleChatThreadUrls, [
			{
				teamSlug: "platform",
				teamName: "Platform",
				url: "https://chat.google.com/room/AAA/BBB",
			},
			{
				teamSlug: "payments",
				teamName: "Payments",
				url: "https://chat.google.com/room/CCC/DDD",
			},
		]);
	} finally {
		fetchStub.restore();
	}
});

test("keeps notifying the other channel when one webhook fails", async () => {
	const fetchStub = stubFetch((url) =>
		url.includes("/platform")
			? new Response("boom", { status: 500, statusText: "Server Error" })
			: new Response("{}", { status: 200 }),
	);
	try {
		const delivery = await deliver([sourceTarget, receivingTarget]);
		assert.deepEqual(delivery.deliveredSlugs, ["payments"]);
		assert.equal(delivery.failures.length, 1);
		assert.match(delivery.failures[0], /^platform: HTTP 500/);
		assert.equal(fetchStub.calls.length, 2);
	} finally {
		fetchStub.restore();
	}
});

test("records a network error per channel without aborting the rest", async () => {
	const fetchStub = stubFetch((url) => {
		if (url.includes("/payments")) {
			throw new Error("network down");
		}
		return new Response("{}", { status: 200 });
	});
	try {
		const delivery = await deliver([sourceTarget, receivingTarget]);
		assert.deepEqual(delivery.deliveredSlugs, ["platform"]);
		assert.deepEqual(delivery.failures, ["payments: network down"]);
	} finally {
		fetchStub.restore();
	}
});

test("tells the receiving team which team the review request came from", async () => {
	const fetchStub = stubFetch(() => new Response("{}", { status: 200 }));
	try {
		await deliver([sourceTarget, receivingTarget]);
		const [ownChannel, otherChannel] = fetchStub.calls;
		assert.equal(ownChannel.body.includes("viene del equipo Platform"), false);
		assert.equal(otherChannel.body.includes("viene del equipo Platform"), true);
	} finally {
		fetchStub.restore();
	}
});

test("only annotates the origin team on external channels", () => {
	assert.equal(
		prependOriginTeamNotice("Hola", "es", "Platform", false),
		"Hola",
	);
	assert.equal(
		prependOriginTeamNotice("Hello", "en", "Platform", true),
		"🔁 This review request comes from team Platform.\nHello",
	);
});

test("adds messageReplyOption so Chat can start a thread per PR", () => {
	assert.equal(
		withGoogleChatMessageReplyOption("https://chat.example.com/platform"),
		"https://chat.example.com/platform?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD",
	);
	assert.equal(
		withGoogleChatMessageReplyOption(
			"https://chat.example.com/platform?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD",
		),
		"https://chat.example.com/platform?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD",
	);
});
