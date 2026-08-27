import assert from "node:assert/strict";
import test from "node:test";
import {
	buildPrAssignmentChatMessage,
	formatGoogleChatPerson,
	formatPrChatButtonLabel,
	getDefaultPRChatMessageTemplate,
	parsePrIdentity,
	parsePrNumber,
	REQUIRED_PR_CHAT_PLACEHOLDERS,
	stripPrLinkPlaceholders,
} from "../../lib/googleChatMessageTemplate";

test("uses a Chat mention when a user id is present", () => {
	assert.equal(formatGoogleChatPerson("Hugo", "abc123"), "<users/abc123>");
});

test("falls back to the plain name when there is no chat id", () => {
	assert.equal(formatGoogleChatPerson("Hugo"), "Hugo");
	assert.equal(formatGoogleChatPerson("Hugo", undefined), "Hugo");
});

test("treats empty or whitespace chat ids as missing", () => {
	assert.equal(formatGoogleChatPerson("Hugo", ""), "Hugo");
	assert.equal(formatGoogleChatPerson("Hugo", "   "), "Hugo");
});

test("trims the chat id and the fallback name", () => {
	assert.equal(formatGoogleChatPerson("Hugo", "  abc123  "), "<users/abc123>");
	assert.equal(formatGoogleChatPerson("  Hugo  "), "Hugo");
});

test("default templates mention reviewer and requester without a PR link", () => {
	const es = getDefaultPRChatMessageTemplate("es");
	const en = getDefaultPRChatMessageTemplate("en");

	assert.equal(
		es,
		"Hola {{reviewer_name}} 👋\n{{requester_name}} te ha asignado esta revisión",
	);
	assert.equal(
		en,
		"Hi {{reviewer_name}} 👋\n{{requester_name}} assigned you this review",
	);
	assert.equal(REQUIRED_PR_CHAT_PLACEHOLDERS.length, 2);
	assert.ok(!es.includes("URL_PLACEHOLDER"));
	assert.ok(!en.includes("|PR>"));
});

test("strips leftover PR placeholders and Chat PR links", () => {
	assert.equal(
		stripPrLinkPlaceholders(
			"Hola {{reviewer_name}}, revisa este <URL_PLACEHOLDER|PR> porfa",
		),
		"Hola {{reviewer_name}}, revisa este porfa",
	);
	assert.equal(
		stripPrLinkPlaceholders("Link {{pr}} and {{PR}} here"),
		"Link and here",
	);
	assert.equal(
		stripPrLinkPlaceholders(
			"Revisa <https://github.com/org/repo/pull/12|PR> ahora",
		),
		"Revisa ahora",
	);
	assert.equal(
		stripPrLinkPlaceholders("Docs: <https://example.com/guide|docs>"),
		"Docs: <https://example.com/guide|docs>",
	);
});

test("parses PR identity from GitHub, GitLab, and unknown URLs", () => {
	assert.equal(
		parsePrIdentity("https://github.com/org/repo/pull/12"),
		"org/repo #12",
	);
	assert.equal(
		parsePrIdentity("https://www.github.com/org/repo/pulls/12?foo=1"),
		"org/repo #12",
	);
	assert.equal(
		parsePrIdentity("https://gitlab.com/group/project/-/merge_requests/45"),
		"group/project !45",
	);
	assert.equal(
		parsePrIdentity("https://gitlab.com/group/sub/project/-/merge_requests/7"),
		"group/sub/project !7",
	);
	assert.equal(
		parsePrIdentity("https://example.com/reviews/99"),
		"example.com",
	);
	assert.equal(parsePrIdentity("not-a-url"), "not-a-url");
});

test("labels the PR button with the pull request number", () => {
	assert.equal(parsePrNumber("https://github.com/org/repo/pull/12"), "12");
	assert.equal(
		parsePrNumber("https://gitlab.com/group/project/-/merge_requests/45"),
		"45",
	);
	assert.equal(parsePrNumber("https://example.com/reviews/99"), undefined);
	assert.equal(
		formatPrChatButtonLabel("https://github.com/org/repo/pull/12"),
		"PR #12",
	);
	assert.equal(formatPrChatButtonLabel("https://example.com/docs"), "PR");
});

test("builds a compact assignment card with only a PR button", () => {
	const payload = buildPrAssignmentChatMessage({
		text: "Hola Hugo",
		prUrl: "https://github.com/org/repo/pull/12",
		locale: "es",
	});
	const card = payload.cardsV2[0]?.card;

	assert.equal(payload.text, "Hola Hugo");
	assert.equal(payload.cardsV2[0]?.cardId, "pr-assignment-card");
	assert.deepEqual(card?.sections?.[0]?.widgets?.[0]?.buttonList?.buttons, [
		{
			text: "PR #12",
			onClick: { openLink: { url: "https://github.com/org/repo/pull/12" } },
		},
	]);
	assert.equal(
		payload.thread.threadKey,
		"REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD ",
	);
});

test("adds a context button when a context URL is present", () => {
	const payload = buildPrAssignmentChatMessage({
		text: "Hola Hugo",
		prUrl: "https://github.com/org/repo/pull/12",
		contextUrl: "https://docs.example.com/ticket",
		locale: "es",
		urgent: true,
		cardId: "pr-assignment-batch-card",
	});
	const card = payload.cardsV2[0]?.card;
	const buttons = card?.sections?.[0]?.widgets?.[0]?.buttonList?.buttons;

	assert.equal(payload.cardsV2[0]?.cardId, "pr-assignment-batch-card");
	assert.equal(buttons?.length, 2);
	assert.equal(buttons?.[0]?.text, "PR #12");
	assert.equal(buttons?.[1]?.text, "Contexto");
	assert.equal(
		buttons?.[1]?.onClick.openLink.url,
		"https://docs.example.com/ticket",
	);
});
