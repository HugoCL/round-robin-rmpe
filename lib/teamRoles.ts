/**
 * Team roles: owner and member.
 *
 * Membership used to be flat, so every deployed `reviewers` row has no role.
 * The helpers here are pure so the backfill choice and the legacy fallback can
 * be tested directly.
 */

export type TeamRole = "owner" | "member";

export type RoleBearingReviewer = {
	role?: TeamRole;
};

/**
 * The ONLY correct way to read a role.
 *
 * A direct `role === "owner"` comparison treats every pre-migration row as a
 * member, which would lock existing teams out of the owner-gated mutations.
 */
export function resolveReviewerRole(reviewer: RoleBearingReviewer): TeamRole {
	return reviewer.role ?? "member";
}

export function isTeamOwner(reviewer: RoleBearingReviewer): boolean {
	return resolveReviewerRole(reviewer) === "owner";
}

/** True when at least one row on the team carries the owner role. */
export function teamHasOwner<T extends RoleBearingReviewer>(
	reviewers: readonly T[],
): boolean {
	return reviewers.some(isTeamOwner);
}

/**
 * May a member run an owner-gated action?
 *
 * `teamHasOwner === false` means the team predates the roles migration, where
 * every row is `role: undefined`, or that it somehow lost its owners. Denying
 * there would lock the entire team out of settings, roster imports and backup
 * restores with nobody able to grant the role, so the gate stays at member
 * level until the team actually has an owner. It self-activates the moment the
 * backfill runs, which is what lets the field and the gate ship together.
 */
export function canAdministerTeam({
	isOwner,
	teamHasOwner: hasOwner,
}: {
	isOwner: boolean;
	teamHasOwner: boolean;
}): boolean {
	return isOwner || !hasOwner;
}

export type OwnerCandidate = {
	_id: string;
	email: string;
	createdAt: number;
	/** Convex system field. Always present, and monotonic within a deployment. */
	_creationTime: number;
};

/** Seed rows from `initializeData`, which can predate the real team creator. */
const SEED_EMAIL_DOMAIN = "@example.com";

export type OwnerPick<T extends OwnerCandidate> = {
	owner: T | null;
	/** How many rows tied on createdAt with the winner, before the tiebreak. */
	tiedCount: number;
	/** True when demo rows were set aside to reach a real person. */
	filteredSeedRows: boolean;
};

/**
 * Picks the reviewer who becomes the owner of an existing team.
 *
 * The rule is "the person who created the team", approximated by the oldest
 * row, with two corrections drawn from how rows actually get written:
 *
 *  - `initializeData` seeds `@example.com` demo reviewers that can be older
 *    than the real creator, so they are set aside unless nothing else is left.
 *  - `importReviewersData` deletes and reinserts the whole roster with
 *    `createdAt: reviewerData.createdAt || Date.now()`, so an imported team can
 *    have every row tied at one millisecond. `_creationTime` breaks that tie.
 */
export function pickTeamOwnerCandidate<T extends OwnerCandidate>(
	reviewers: readonly T[],
): OwnerPick<T> {
	if (reviewers.length === 0) {
		return { owner: null, tiedCount: 0, filteredSeedRows: false };
	}

	const realPeople = reviewers.filter(
		(reviewer) =>
			!reviewer.email.trim().toLowerCase().endsWith(SEED_EMAIL_DOMAIN),
	);
	const filteredSeedRows =
		realPeople.length > 0 && realPeople.length < reviewers.length;
	const candidates = realPeople.length > 0 ? realPeople : reviewers;

	const sorted = [...candidates].sort((a, b) => {
		if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
		return a._creationTime - b._creationTime;
	});

	const owner = sorted[0] ?? null;
	const tiedCount = owner
		? candidates.filter((reviewer) => reviewer.createdAt === owner.createdAt)
				.length
		: 0;

	return { owner, tiedCount, filteredSeedRows };
}

/** Would the team still have an owner after this change? */
export function teamRetainsOwner<
	T extends RoleBearingReviewer & { _id: string },
>(
	reviewers: readonly T[],
	{ excluding, demoting }: { excluding?: string; demoting?: string } = {},
): boolean {
	return reviewers.some((reviewer) => {
		if (excluding !== undefined && reviewer._id === excluding) return false;
		if (demoting !== undefined && reviewer._id === demoting) return false;
		return isTeamOwner(reviewer);
	});
}
