import assert from "node:assert/strict";
import test from "node:test";
import {
	type ChangelogEntry,
	changelogEntries,
	isLaunchSpotlightId,
	LAUNCH_SPOTLIGHT_DAYS,
	pickLaunchSpotlight,
} from "../../lib/changelog";

const entry = (
	date: string,
	spotlightId?: string,
	title = spotlightId ?? "plain",
): ChangelogEntry => ({
	date,
	type: "feature",
	title,
	description: "",
	spotlight: spotlightId ? { id: spotlightId, summary: "" } : undefined,
});

test("a launch nobody has dismissed shows", () => {
	const picked = pickLaunchSpotlight(
		[entry("2026-11-23", "custom-view")],
		[],
		"2026-11-24",
	);
	assert.equal(picked?.spotlight.id, "custom-view");
});

test("a dismissed launch never shows again", () => {
	assert.equal(
		pickLaunchSpotlight(
			[entry("2026-11-23", "custom-view")],
			["custom-view"],
			"2026-11-24",
		),
		null,
	);
});

test("an entry without a spotlight stays in the changelog only", () => {
	assert.equal(
		pickLaunchSpotlight([entry("2026-11-23")], [], "2026-11-24"),
		null,
	);
});

test("the newest unseen launch wins, whatever the order of the entries", () => {
	const entries = [
		entry("2026-11-10", "older"),
		entry("2026-11-23", "newer"),
		entry("2026-11-01", "oldest"),
	];
	assert.equal(
		pickLaunchSpotlight(entries, [], "2026-11-24")?.spotlight.id,
		"newer",
	);
	assert.equal(
		pickLaunchSpotlight(entries, ["newer"], "2026-11-24")?.spotlight.id,
		"older",
	);
});

test("a launch stops being news after the spotlight window", () => {
	const launch = [entry("2026-11-23", "custom-view")];
	assert.equal(LAUNCH_SPOTLIGHT_DAYS, 30);
	assert.ok(pickLaunchSpotlight(launch, [], "2026-12-23"));
	assert.equal(pickLaunchSpotlight(launch, [], "2026-12-24"), null);
});

test("a launch dated in the future waits for its day", () => {
	const launch = [entry("2026-11-23", "custom-view")];
	assert.equal(pickLaunchSpotlight(launch, [], "2026-11-22"), null);
	assert.ok(pickLaunchSpotlight(launch, [], "2026-11-23"));
});

test("only ids of real launches can be stored as seen", () => {
	assert.equal(isLaunchSpotlightId("custom-view"), true);
	assert.equal(isLaunchSpotlightId("anything-else"), false);
});

test("spotlight ids are unique, so dismissing one launch never hides another", () => {
	const ids = changelogEntries.flatMap((item) =>
		item.spotlight ? [item.spotlight.id] : [],
	);
	assert.equal(new Set(ids).size, ids.length);
});

test("a spotlighted launch has the video and the sentence the card shows", () => {
	for (const item of changelogEntries) {
		if (!item.spotlight) continue;
		assert.ok(item.video, `${item.spotlight.id} needs a video`);
		assert.ok(item.spotlight.summary.length > 0);
	}
});
