/**
 * Reviewer pool for a cross-team review request.
 *
 * The requesting team's own reviewers take part unless the requester asked to
 * exclude their teammates, in which case only the other teams supply reviewers.
 * Every reviewer stays tagged with the team they belong to so the assignment
 * can later notify that team's Google Chat channel.
 */

type PoolReviewer = { _id: string | { toString(): string } };

export type CrossTeamPool<TReviewer> = {
	reviewers: TReviewer[];
	teamSlugByReviewerId: Map<string, string>;
};

export function buildCrossTeamReviewerPool<
	TReviewer extends PoolReviewer,
>(options: {
	sourceTeamSlug: string;
	sourceReviewers: TReviewer[];
	additionalTeams: Array<{ teamSlug: string; reviewers: TReviewer[] }>;
	excludeTeammates?: boolean;
}): CrossTeamPool<TReviewer> {
	const excludeTeammates =
		options.excludeTeammates === true && options.additionalTeams.length > 0;
	const teams = [
		...(excludeTeammates
			? []
			: [
					{
						teamSlug: options.sourceTeamSlug,
						reviewers: options.sourceReviewers,
					},
				]),
		...options.additionalTeams,
	];

	const reviewers: TReviewer[] = [];
	const teamSlugByReviewerId = new Map<string, string>();
	for (const team of teams) {
		for (const reviewer of team.reviewers) {
			const reviewerId = String(reviewer._id);
			// A reviewer listed under several teams keeps the first team that
			// offered them, so they are never assigned (or counted) twice.
			if (teamSlugByReviewerId.has(reviewerId)) {
				continue;
			}
			teamSlugByReviewerId.set(reviewerId, team.teamSlug);
			reviewers.push(reviewer);
		}
	}

	return { reviewers, teamSlugByReviewerId };
}
