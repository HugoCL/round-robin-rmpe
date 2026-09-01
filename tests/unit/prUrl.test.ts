import assert from "node:assert/strict";
import { test } from "node:test";
import { isPrUrl, parsePrUrl } from "../../lib/prUrl";

test("parses GitHub pull request links", () => {
	assert.deepEqual(parsePrUrl("https://github.com/buk/rmpe/pull/4821"), {
		repo: "buk/rmpe",
		number: "4821",
	});
	assert.deepEqual(parsePrUrl("https://github.com/buk/rmpe/pull/4821/files"), {
		repo: "buk/rmpe",
		number: "4821",
	});
});

test("parses GitLab merge requests and Bitbucket pull requests", () => {
	assert.deepEqual(
		parsePrUrl("https://gitlab.com/grp/sub/proj/-/merge_requests/42"),
		{ repo: "grp/sub/proj", number: "42" },
	);
	assert.deepEqual(
		parsePrUrl("https://bitbucket.org/team/repo/pull-requests/7"),
		{ repo: "team/repo", number: "7" },
	);
});

test("tolerates surrounding whitespace, query strings and fragments", () => {
	assert.deepEqual(
		parsePrUrl("  https://github.com/buk/rmpe/pull/8?tab=files#note-1  "),
		{ repo: "buk/rmpe", number: "8" },
	);
});

test("rejects anything that is not a pull request link", () => {
	for (const value of [
		"",
		"   ",
		"no-es-una-url",
		"github.com/buk/rmpe/pull/1",
		"ftp://github.com/buk/rmpe/pull/1",
		"https://github.com/buk/rmpe/issues/9",
		"https://github.com/buk/rmpe/pull/",
	]) {
		assert.equal(parsePrUrl(value), null, `expected null for ${value}`);
		assert.equal(isPrUrl(value), false, `expected false for ${value}`);
	}
});
