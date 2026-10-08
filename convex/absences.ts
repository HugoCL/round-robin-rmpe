import { v } from "convex/values";
import {
	compareDateKeys,
	dateKeyRangesOverlap,
	diffInDays,
	EARLIEST_TODAY_TIMEZONE,
	getAbsenceReturnAt,
	getTodayDateKey,
	isValidDateKey,
	MAX_ABSENCE_LENGTH_DAYS,
	plannedAbsenceErrorMessage,
	validateAbsenceRange,
} from "../lib/plannedAbsences";
import { resolveTeamTimezone } from "../lib/reviewerAvailability";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	type MutationCtx,
	mutation,
	query,
} from "./_generated/server";
import { activateAbsence } from "./absenceLifecycle";
import { assertCanMutateTeamById } from "./authz";
import { createSnapshot, returnReviewerToRotation } from "./mutations";

/** Overlap is rejected, so a reviewer has very few open rows; this is a safety bound. */
const MAX_OPEN_ABSENCES_PER_REVIEWER = 50;
const MAX_TEAM_ABSENCES_PER_STATUS = 200;
const MAX_ACTIVATIONS_PER_RUN = 100;

type OpenStatus = "scheduled" | "active";

async function listOpenAbsencesForReviewer(
	ctx: MutationCtx,
	reviewerId: Id<"reviewers">,
): Promise<Doc<"reviewerAbsences">[]> {
	const open: Doc<"reviewerAbsences">[] = [];
	for (const status of [
		"scheduled",
		"active",
	] as const satisfies OpenStatus[]) {
		const rows = await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_reviewerId_and_status", (q) =>
				q.eq("reviewerId", reviewerId).eq("status", status),
			)
			.take(MAX_OPEN_ABSENCES_PER_REVIEWER);
		open.push(...rows);
	}
	return open;
}

async function loadReviewerAndTimeZone(
	ctx: MutationCtx,
	reviewerId: Id<"reviewers">,
	teamId: Id<"teams">,
) {
	const reviewer = await ctx.db.get(reviewerId);
	if (!reviewer) {
		throw new Error("Reviewer not found");
	}
	const team = await ctx.db.get(teamId);
	return { reviewer, timeZone: resolveTeamTimezone(team?.timezone) };
}

function describeRange(startDate: string, endDate: string): string {
	return `(${startDate} → ${endDate})`;
}

export const scheduleAbsence = mutation({
	args: {
		reviewerId: v.id("reviewers"),
		startDate: v.string(),
		endDate: v.string(),
	},
	handler: async (ctx, { reviewerId, startDate, endDate }) => {
		const reviewer = await ctx.db.get(reviewerId);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		const teamId = reviewer.teamId;
		const { normalizedEmail } = await assertCanMutateTeamById(ctx, teamId);
		const team = await ctx.db.get(teamId);
		const timeZone = resolveTeamTimezone(team?.timezone);
		const now = Date.now();
		const todayKey = getTodayDateKey(now, timeZone);

		const existing = await listOpenAbsencesForReviewer(ctx, reviewerId);
		const error = validateAbsenceRange({
			range: { startDate, endDate },
			todayKey,
			existing,
		});
		if (error) {
			throw new Error(plannedAbsenceErrorMessage(error));
		}

		const absenceId = await ctx.db.insert("reviewerAbsences", {
			teamId,
			reviewerId,
			startDate,
			endDate,
			status: "scheduled",
			createdByEmail: normalizedEmail ?? undefined,
			createdAt: now,
			updatedAt: now,
		});

		let status: "scheduled" | "active" | "completed" = "scheduled";
		if (compareDateKeys(startDate, todayKey) <= 0) {
			const absence = await ctx.db.get(absenceId);
			if (absence) {
				const outcome = await activateAbsence(
					ctx,
					absence,
					reviewer,
					timeZone,
					now,
				);
				status = outcome === "activated" ? "active" : "completed";
			}
		}

		await createSnapshot(
			ctx,
			teamId,
			`Planned absence for ${reviewer.name} ${describeRange(startDate, endDate)}${
				status === "active" ? ", started now" : ""
			}`,
		);

		return { absenceId, status };
	},
});

export const updateAbsence = mutation({
	args: {
		absenceId: v.id("reviewerAbsences"),
		startDate: v.string(),
		endDate: v.string(),
	},
	handler: async (ctx, { absenceId, startDate, endDate }) => {
		const absence = await ctx.db.get(absenceId);
		if (!absence) {
			throw new Error("Absence not found");
		}
		await assertCanMutateTeamById(ctx, absence.teamId);
		if (absence.status !== "scheduled" && absence.status !== "active") {
			throw new Error("Absence is no longer editable");
		}
		const { reviewer, timeZone } = await loadReviewerAndTimeZone(
			ctx,
			absence.reviewerId,
			absence.teamId,
		);
		const now = Date.now();
		const todayKey = getTodayDateKey(now, timeZone);
		const others = (
			await listOpenAbsencesForReviewer(ctx, absence.reviewerId)
		).filter((other) => other._id !== absenceId);

		if (absence.status === "active") {
			// The absence already started: only the end date can move.
			if (startDate !== absence.startDate) {
				throw new Error(plannedAbsenceErrorMessage("invalidRange"));
			}
			if (!isValidDateKey(endDate)) {
				throw new Error(plannedAbsenceErrorMessage("invalidDate"));
			}
			if (
				compareDateKeys(endDate, startDate) < 0 ||
				compareDateKeys(endDate, todayKey) < 0
			) {
				throw new Error(plannedAbsenceErrorMessage("invalidRange"));
			}
			if (diffInDays(startDate, endDate) + 1 > MAX_ABSENCE_LENGTH_DAYS) {
				throw new Error(plannedAbsenceErrorMessage("tooLong"));
			}
			if (
				others.some((other) =>
					dateKeyRangesOverlap({ startDate, endDate }, other),
				)
			) {
				throw new Error(plannedAbsenceErrorMessage("overlap"));
			}

			await ctx.db.patch(absenceId, { endDate, updatedAt: now });
			if (reviewer.isAbsent && reviewer.absentUntil !== undefined) {
				await ctx.db.patch(reviewer._id, {
					absentUntil: getAbsenceReturnAt(endDate, timeZone),
				});
			}
			await createSnapshot(
				ctx,
				absence.teamId,
				`Updated planned absence for ${reviewer.name} ${describeRange(startDate, endDate)}`,
			);
			return { status: "active" as const };
		}

		const error = validateAbsenceRange({
			range: { startDate, endDate },
			todayKey,
			existing: others,
		});
		if (error) {
			throw new Error(plannedAbsenceErrorMessage(error));
		}

		await ctx.db.patch(absenceId, { startDate, endDate, updatedAt: now });

		let status: "scheduled" | "active" | "completed" = "scheduled";
		if (compareDateKeys(startDate, todayKey) <= 0) {
			const outcome = await activateAbsence(
				ctx,
				{ ...absence, startDate, endDate },
				reviewer,
				timeZone,
				now,
			);
			status = outcome === "activated" ? "active" : "completed";
		}

		await createSnapshot(
			ctx,
			absence.teamId,
			`Updated planned absence for ${reviewer.name} ${describeRange(startDate, endDate)}${
				status === "active" ? ", started now" : ""
			}`,
		);
		return { status };
	},
});

export const cancelAbsence = mutation({
	args: {
		absenceId: v.id("reviewerAbsences"),
	},
	handler: async (ctx, { absenceId }) => {
		const absence = await ctx.db.get(absenceId);
		if (!absence) {
			throw new Error("Absence not found");
		}
		await assertCanMutateTeamById(ctx, absence.teamId);
		if (absence.status !== "scheduled" && absence.status !== "active") {
			throw new Error("Absence is no longer editable");
		}
		const reviewer = await ctx.db.get(absence.reviewerId);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}
		const now = Date.now();
		const range = describeRange(absence.startDate, absence.endDate);

		if (absence.status === "scheduled") {
			await ctx.db.patch(absenceId, { status: "cancelled", updatedAt: now });
			await createSnapshot(
				ctx,
				absence.teamId,
				`Cancelled planned absence for ${reviewer.name} ${range}`,
			);
			return { status: "cancelled" as const };
		}

		// Active: the reviewer comes back now; this also completes the row.
		const assignmentCount = await returnReviewerToRotation(ctx, reviewer, now);
		await createSnapshot(
			ctx,
			absence.teamId,
			`Cancelled planned absence for ${reviewer.name} ${range}, marked available and updated assignment count to ${assignmentCount}`,
		);
		return { status: "completed" as const };
	},
});

export const listTeamAbsences = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await ctx.db
			.query("teams")
			.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
			.first();
		if (!team) {
			throw new Error("Team not found");
		}
		const absences: Doc<"reviewerAbsences">[] = [];
		for (const status of ["scheduled", "active"] as const) {
			const rows = await ctx.db
				.query("reviewerAbsences")
				.withIndex("by_teamId_and_status", (q) =>
					q.eq("teamId", team._id).eq("status", status),
				)
				.take(MAX_TEAM_ABSENCES_PER_STATUS);
			absences.push(...rows);
		}
		return absences;
	},
});

// Starts scheduled absences whose start date has arrived in their team's timezone
export const processPlannedAbsences = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		// Cheap superset: the earliest timezone on Earth reaches each date first.
		const earliestToday = getTodayDateKey(now, EARLIEST_TODAY_TIMEZONE);
		const due = await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_status_and_startDate", (q) =>
				q.eq("status", "scheduled").lte("startDate", earliestToday),
			)
			.take(MAX_ACTIVATIONS_PER_RUN);

		const teams = new Map<Id<"teams">, Doc<"teams"> | null>();
		let activated = 0;
		let expired = 0;

		for (const absence of due) {
			let team = teams.get(absence.teamId);
			if (team === undefined) {
				team = await ctx.db.get(absence.teamId);
				teams.set(absence.teamId, team);
			}
			const timeZone = resolveTeamTimezone(team?.timezone);
			if (
				compareDateKeys(getTodayDateKey(now, timeZone), absence.startDate) < 0
			) {
				continue;
			}
			const reviewer = await ctx.db.get(absence.reviewerId);
			if (!reviewer) {
				// Orphaned row; cancel so it cannot sit at the head of the queue.
				await ctx.db.patch(absence._id, {
					status: "cancelled",
					updatedAt: now,
				});
				continue;
			}
			const outcome = await activateAbsence(
				ctx,
				absence,
				reviewer,
				timeZone,
				now,
			);
			if (outcome === "expired") {
				expired += 1;
				continue;
			}
			activated += 1;
			await createSnapshot(
				ctx,
				absence.teamId,
				`Planned absence started for ${reviewer.name} ${describeRange(absence.startDate, absence.endDate)}`,
			);
		}

		return { activated, expired };
	},
});
