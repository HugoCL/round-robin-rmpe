const DAY_MS = 24 * 60 * 60 * 1000;

type AssignmentMetricRow = {
	id: string;
	timestamp: number;
	batchId?: string;
	skipped: boolean;
	isAbsentSkip: boolean;
	urgent?: boolean;
	crossTeamReview?: boolean;
	source?: "ui" | "agent";
};

export function summarizeRecentAssignments(
	rows: AssignmentMetricRow[],
	now: number,
) {
	const today = new Date(now);
	const todayUtc = Date.UTC(
		today.getUTCFullYear(),
		today.getUTCMonth(),
		today.getUTCDate(),
	);
	const firstDay = todayUtc - 6 * DAY_MS;
	const assignments = new Map<
		string,
		Pick<
			AssignmentMetricRow,
			"timestamp" | "urgent" | "crossTeamReview" | "source"
		>
	>();

	for (const row of rows) {
		if (row.timestamp < firstDay || row.skipped || row.isAbsentSkip) continue;

		const key = row.batchId ? `batch:${row.batchId}` : `single:${row.id}`;
		const assignment = assignments.get(key);
		if (assignment) {
			assignment.urgent ||= row.urgent;
			assignment.crossTeamReview ||= row.crossTeamReview;
			if (row.source === "agent") assignment.source = "agent";
		} else {
			assignments.set(key, row);
		}
	}

	const dailyActivity = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(firstDay + index * DAY_MS);
		return { date: date.toISOString().slice(0, 10), count: 0 };
	});
	let viaAgent = 0;
	let urgent = 0;
	let crossTeam = 0;

	for (const assignment of assignments.values()) {
		const dayIndex = Math.floor((assignment.timestamp - firstDay) / DAY_MS);
		if (dailyActivity[dayIndex]) dailyActivity[dayIndex].count += 1;
		if (assignment.source === "agent") viaAgent += 1;
		if (assignment.urgent) urgent += 1;
		if (assignment.crossTeamReview) crossTeam += 1;
	}

	return {
		total: assignments.size,
		viaAgent,
		urgent,
		crossTeam,
		dailyActivity,
	};
}
