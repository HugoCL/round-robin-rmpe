export type ChatThreadLink = {
	teamSlug: string;
	teamName: string;
	url: string;
};

function normalizeThreadLink(link: ChatThreadLink): ChatThreadLink | null {
	const teamSlug = link.teamSlug.trim();
	const url = link.url.trim();
	if (!teamSlug || !url) return null;
	return {
		teamSlug,
		teamName: link.teamName.trim() || teamSlug,
		url,
	};
}

/** Merge Chat message links by team slug, keeping the latest URL for each space. */
export function mergeChatThreadLinks(
	existing: ChatThreadLink[] | undefined,
	incoming: ChatThreadLink[],
): ChatThreadLink[] {
	const bySlug = new Map<string, ChatThreadLink>();
	for (const link of existing ?? []) {
		const normalized = normalizeThreadLink(link);
		if (normalized) {
			bySlug.set(normalized.teamSlug, normalized);
		}
	}
	for (const link of incoming) {
		const normalized = normalizeThreadLink(link);
		if (normalized) {
			bySlug.set(normalized.teamSlug, normalized);
		}
	}
	return [...bySlug.values()];
}

export function legacyChatThreadLinks(
	googleChatThreadUrl?: string,
	links?: ChatThreadLink[],
): ChatThreadLink[] {
	if (links && links.length > 0) {
		return mergeChatThreadLinks(undefined, links);
	}
	const url = googleChatThreadUrl?.trim();
	if (!url) return [];
	return [
		{
			teamSlug: "chat",
			teamName: "Chat",
			url,
		},
	];
}

type HistoryReviewer = {
	name: string;
	email?: string;
};

/**
 * Resolve the person who requested the review.
 *
 * History rows may point at a reviewer from another team, so the lookup map
 * must include those IDs. If the reviewer document is gone, fall back to the
 * name stored on the row so the assigner still shows in the feed.
 */
export function resolveHistoryAssigner(options: {
	actionByReviewerId?: string;
	actionByName?: string;
	reviewerById: Map<string, HistoryReviewer>;
}): { actionByName?: string; actionByEmail?: string } {
	const reviewer = options.actionByReviewerId
		? options.reviewerById.get(options.actionByReviewerId)
		: undefined;
	if (reviewer) {
		return {
			actionByName: reviewer.name,
			actionByEmail: reviewer.email,
		};
	}
	const fallbackName = options.actionByName?.trim();
	if (fallbackName) {
		return { actionByName: fallbackName };
	}
	return {};
}
