"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function useConvexTags(teamSlug?: string) {
	// Queries - these are automatically reactive and cached
	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") ?? [];
	const loading = tags === undefined;

	// No need for manual refresh since Convex provides real-time updates
	const refreshTags = () => {
		// No-op since Convex handles real-time updates automatically
	};

	return {
		tags,
		loading,
		refreshTags,
		hasTags: tags.length > 0,
	};
}
