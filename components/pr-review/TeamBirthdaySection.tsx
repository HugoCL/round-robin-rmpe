"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BirthdayCelebrationOverlay } from "./BirthdayCelebrationOverlay";
import { BirthdaySetupBanner } from "./BirthdaySetupBanner";
import { BirthdayTeamNoticeBanner } from "./BirthdayTeamNoticeBanner";

export function TeamBirthdaySection({ teamSlug }: { teamSlug?: string }) {
	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");

	if (!teamSlug || team === undefined || team === null) {
		return null;
	}

	const timeZone = team.timezone;

	return (
		<>
			<BirthdaySetupBanner />
			<BirthdayTeamNoticeBanner teamTimezone={timeZone} />
			<BirthdayCelebrationOverlay teamSlug={teamSlug} teamTimezone={timeZone} />
		</>
	);
}
