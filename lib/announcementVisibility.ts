/**
 * Pure visibility rules for announcements.
 *
 * Kept out of the Convex handler so the schedule/audience/dismissal logic is
 * directly testable, which matters because getting it wrong either hides a
 * real announcement or shows a retired one to everyone.
 */

export type AnnouncementAudience = "everyone" | "admins" | "teams";

export type AnnouncementVisibilityInput = {
	key: string;
	status: "draft" | "published" | "archived";
	audience: AnnouncementAudience;
	teamIds?: string[];
	requiresTeamEvents?: boolean;
	startsAt?: number;
	endsAt?: number;
	order?: number;
};

export type ViewerContext = {
	now: number;
	isAdmin: boolean;
	teamId?: string | null;
	teamHasEvents?: boolean;
	dismissedKeys: ReadonlySet<string>;
};

export function isAnnouncementVisible(
	announcement: AnnouncementVisibilityInput,
	viewer: ViewerContext,
): boolean {
	if (announcement.status !== "published") return false;
	if (viewer.dismissedKeys.has(announcement.key)) return false;

	// Convex queries react to data, not to the clock: a window that closes
	// while a tab is idle takes effect on the next data change or page load.
	// That is fine for banners, and cheaper than a cron that rewrites rows.
	if (
		announcement.startsAt !== undefined &&
		viewer.now < announcement.startsAt
	) {
		return false;
	}
	if (announcement.endsAt !== undefined && viewer.now >= announcement.endsAt) {
		return false;
	}

	if (
		announcement.requiresTeamEvents === true &&
		viewer.teamHasEvents !== true
	) {
		return false;
	}

	switch (announcement.audience) {
		case "everyone":
			return true;
		case "admins":
			return viewer.isAdmin;
		case "teams": {
			const targets = announcement.teamIds ?? [];
			if (targets.length === 0) return false;
			return viewer.teamId !== null && viewer.teamId !== undefined
				? targets.includes(viewer.teamId)
				: false;
		}
		default: {
			const _exhaustive: never = announcement.audience;
			return _exhaustive;
		}
	}
}

/** Explicit `order` first (ascending), then newest-first by key as a stable tiebreak. */
export function sortAnnouncements<T extends { order?: number; key: string }>(
	announcements: readonly T[],
): T[] {
	return [...announcements].sort((a, b) => {
		const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
		const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
		if (orderA !== orderB) return orderA - orderB;
		return a.key.localeCompare(b.key);
	});
}

/** Picks the body for a locale, falling back to the other one rather than rendering nothing. */
export function resolveAnnouncementBody(
	announcement: { bodyEs?: string; bodyEn?: string },
	locale: string,
): string | null {
	const preferred = locale === "en" ? announcement.bodyEn : announcement.bodyEs;
	const fallback = locale === "en" ? announcement.bodyEs : announcement.bodyEn;
	const chosen = preferred?.trim() || fallback?.trim();
	return chosen && chosen.length > 0 ? chosen : null;
}
