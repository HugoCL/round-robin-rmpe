"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const DEFAULT_TIME_ZONE = "America/Santiago";

export function useTeamWeeklyPrCount(teamSlug?: string) {
	const weeklyStats = useQuery(
		api.queries.getTeamWeeklyPrCount,
		teamSlug ? { teamSlug } : "skip",
	);

	return {
		count: weeklyStats?.count ?? 0,
		weekStartMs: weeklyStats?.weekStartMs,
		weekEndMs: weeklyStats?.weekEndMs,
		timeZone: weeklyStats?.timeZone ?? DEFAULT_TIME_ZONE,
		isLoading: teamSlug ? weeklyStats === undefined : false,
	};
}
