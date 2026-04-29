/** Reviewer row or enriched shape with optional pool exclusion */
export type ReviewerPoolExclusionInput = {
	excludedFromReviewPool?: boolean;
};

export function isExcludedFromReviewPool(
	reviewer: ReviewerPoolExclusionInput,
): boolean {
	return reviewer.excludedFromReviewPool === true;
}

/** Enriched reviewer from Convex getReviewers (includes effectiveIsAbsent) */
export function isEligibleForAssignment(reviewer: {
	excludedFromReviewPool?: boolean;
	effectiveIsAbsent: boolean;
}): boolean {
	return !isExcludedFromReviewPool(reviewer) && !reviewer.effectiveIsAbsent;
}
