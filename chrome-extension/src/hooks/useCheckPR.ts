import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

const api = anyApi as any;

/**
 * Check if a PR URL has already been assigned.
 */
export function useCheckPR(teamSlug: string | null, prUrl: string | null) {
	const result = useQuery(
		api.queries.checkPRAlreadyAssigned,
		teamSlug && prUrl ? { teamSlug, prUrl } : "skip",
	);

	return result ?? null;
}
