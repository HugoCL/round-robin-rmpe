import assert from "node:assert/strict";
import test from "node:test";
import {
	type AnnouncementVisibilityInput,
	isAnnouncementVisible,
	resolveAnnouncementBody,
	sortAnnouncements,
	type ViewerContext,
} from "../../lib/announcementVisibility";

const NOW = 1_700_000_000_000;

function announcement(
	overrides: Partial<AnnouncementVisibilityInput> = {},
): AnnouncementVisibilityInput {
	return {
		key: "a",
		status: "published",
		audience: "everyone",
		...overrides,
	};
}

function viewer(overrides: Partial<ViewerContext> = {}): ViewerContext {
	return {
		now: NOW,
		isAdmin: false,
		dismissedKeys: new Set<string>(),
		...overrides,
	};
}

test("only published announcements are visible", () => {
	assert.equal(isAnnouncementVisible(announcement(), viewer()), true);
	assert.equal(
		isAnnouncementVisible(announcement({ status: "draft" }), viewer()),
		false,
	);
	assert.equal(
		isAnnouncementVisible(announcement({ status: "archived" }), viewer()),
		false,
	);
});

test("dismissal hides an announcement for that user only", () => {
	assert.equal(
		isAnnouncementVisible(
			announcement({ key: "coord" }),
			viewer({ dismissedKeys: new Set(["coord"]) }),
		),
		false,
	);
	assert.equal(
		isAnnouncementVisible(
			announcement({ key: "coord" }),
			viewer({ dismissedKeys: new Set(["other"]) }),
		),
		true,
	);
});

test("the schedule window is half-open: inclusive start, exclusive end", () => {
	const scheduled = announcement({ startsAt: NOW, endsAt: NOW + 1000 });
	assert.equal(
		isAnnouncementVisible(scheduled, viewer({ now: NOW - 1 })),
		false,
	);
	assert.equal(isAnnouncementVisible(scheduled, viewer({ now: NOW })), true);
	assert.equal(
		isAnnouncementVisible(scheduled, viewer({ now: NOW + 999 })),
		true,
	);
	assert.equal(
		isAnnouncementVisible(scheduled, viewer({ now: NOW + 1000 })),
		false,
	);
});

test("audience gates on admin status and team membership", () => {
	const adminsOnly = announcement({ audience: "admins" });
	assert.equal(
		isAnnouncementVisible(adminsOnly, viewer({ isAdmin: true })),
		true,
	);
	assert.equal(
		isAnnouncementVisible(adminsOnly, viewer({ isAdmin: false })),
		false,
	);

	const targeted = announcement({ audience: "teams", teamIds: ["t1", "t2"] });
	assert.equal(isAnnouncementVisible(targeted, viewer({ teamId: "t1" })), true);
	assert.equal(
		isAnnouncementVisible(targeted, viewer({ teamId: "t3" })),
		false,
	);
	assert.equal(
		isAnnouncementVisible(targeted, viewer({ teamId: null })),
		false,
	);
	assert.equal(isAnnouncementVisible(targeted, viewer()), false);

	// A "teams" announcement with no targets reaches nobody rather than everybody.
	assert.equal(
		isAnnouncementVisible(
			announcement({ audience: "teams", teamIds: [] }),
			viewer({ teamId: "t1" }),
		),
		false,
	);
});

test("requiresTeamEvents keeps the legacy conditional banner behaviour", () => {
	const conditional = announcement({ requiresTeamEvents: true });
	assert.equal(
		isAnnouncementVisible(conditional, viewer({ teamHasEvents: true })),
		true,
	);
	assert.equal(
		isAnnouncementVisible(conditional, viewer({ teamHasEvents: false })),
		false,
	);
	assert.equal(isAnnouncementVisible(conditional, viewer()), false);
});

test("sortAnnouncements puts explicit order first and is stable without it", () => {
	const sorted = sortAnnouncements([
		{ key: "c" },
		{ key: "a", order: 2 },
		{ key: "b", order: 1 },
		{ key: "d" },
	]);
	assert.deepEqual(
		sorted.map((item) => item.key),
		["b", "a", "c", "d"],
	);
});

test("resolveAnnouncementBody falls back to the other locale rather than rendering nothing", () => {
	assert.equal(
		resolveAnnouncementBody({ bodyEs: "Hola", bodyEn: "Hi" }, "es"),
		"Hola",
	);
	assert.equal(
		resolveAnnouncementBody({ bodyEs: "Hola", bodyEn: "Hi" }, "en"),
		"Hi",
	);
	assert.equal(resolveAnnouncementBody({ bodyEs: "Hola" }, "en"), "Hola");
	assert.equal(resolveAnnouncementBody({ bodyEn: "Hi" }, "es"), "Hi");
	assert.equal(resolveAnnouncementBody({ bodyEs: "   " }, "es"), null);
	assert.equal(resolveAnnouncementBody({}, "es"), null);
});
