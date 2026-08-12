import assert from "node:assert/strict";
import test from "node:test";
import { formatGoogleChatPerson } from "../../lib/googleChatMessageTemplate";

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
