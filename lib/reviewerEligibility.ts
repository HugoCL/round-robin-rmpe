/** Reviewer row or enriched shape with optional pool exclusion */
export type ReviewerPoolExclusionInput = {
	excludedFromReviewPool?: boolean;
	includedInTagRotations?: boolean;
};

export function isExcludedFromReviewPool(
	reviewer: ReviewerPoolExclusionInput,
): boolean {
	return reviewer.excludedFromReviewPool === true;
}

export function isIncludedInTagRotations(
	reviewer: ReviewerPoolExclusionInput,
): boolean {
	return reviewer.includedInTagRotations ?? !isExcludedFromReviewPool(reviewer);
}

export function isEligibleForAssignment<TagId>(
	reviewer: {
		excludedFromReviewPool?: boolean;
		includedInTagRotations?: boolean;
		effectiveIsAbsent: boolean;
		tags?: readonly TagId[];
	},
	tagId?: TagId,
): boolean {
	if (reviewer.effectiveIsAbsent) return false;
	if (tagId === undefined) return !isExcludedFromReviewPool(reviewer);
	if (!isIncludedInTagRotations(reviewer)) return false;
	return (
		reviewer.tags?.some((candidate) => String(candidate) === String(tagId)) ??
		false
	);
}
