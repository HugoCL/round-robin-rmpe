export function undoRemovesReviewedPR(
	rows: Array<{ skipped: boolean; isAbsentSkip: boolean }>,
) {
	return rows.some((row) => !row.skipped && !row.isAbsentSkip);
}
