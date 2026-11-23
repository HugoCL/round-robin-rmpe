type TeamRef = { slug: string };

/** Splits the instance's teams into the viewer's own and the rest, keeping order. */
export function groupTeamsByMembership<T extends TeamRef>(
	teams: readonly T[],
	memberTeamSlugs: readonly string[],
): { mine: T[]; others: T[] } {
	const memberSlugs = new Set(memberTeamSlugs);
	const mine: T[] = [];
	const others: T[] = [];
	for (const team of teams) {
		(memberSlugs.has(team.slug) ? mine : others).push(team);
	}
	return { mine, others };
}

/**
 * Where a signed-in person lands: the team they last opened, else one of
 * their own, else any team so admins and newcomers still reach a board.
 */
export function pickLandingTeamSlug({
	teams,
	memberTeamSlugs,
	lastTeamSlug,
}: {
	teams: readonly TeamRef[];
	memberTeamSlugs: readonly string[];
	lastTeamSlug: string | null;
}): string | null {
	if (lastTeamSlug && teams.some((team) => team.slug === lastTeamSlug)) {
		return lastTeamSlug;
	}
	const { mine } = groupTeamsByMembership(teams, memberTeamSlugs);
	return mine[0]?.slug ?? teams[0]?.slug ?? null;
}
