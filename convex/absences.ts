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
	resolveUpdatedAbsentUntil,
	validateAbsenceRange,
} from "../lib/plannedAbsences";
import { resolveTeamTimezone } from "../lib/reviewerAvailability";
import { internal } from "./_generated/api";
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

const MAX_TEAM_ABSENCES_PER_STATUS = 200;
/** Due activations (each with a snapshot) handled per run before continuing. */
const MAX_ACTIVATIONS_PER_RUN = 25;
const MAX_CLOSES_PER_RUN = 100;

/**
 * Rows of the reviewer that could overlap a range ending on `endDate`.
 *
 * A reviewer's scheduled and active rows never overlap each other (every
 * write path checks this), so within one status the rows are disjoint and
 * ordered by startDate. Any row that overlaps the new range starts on or
 * before `endDate`, and among those only the one with the greatest startDate
 * can reach back to the range's start. Per status we therefore read the two
 * latest rows starting on or before `endDate` (two so the row being updated
 * can be skipped) and keep the first other row. The caller compares dates.
 */
async function findOverlapCandidates(
	ctx: MutationCtx,
	reviewerId: Id<"reviewers">,
	endDate: string,
	excludeAbsenceId?: Id<"reviewerAbsences">,
): Promise<Doc<"reviewerAbsences">[]> {
	const candidates: Doc<"reviewerAbsences">[] = [];
	for (const status of ["scheduled", "active"] as const) {
		const latest = await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_reviewerId_and_status_and_startDate", (q) =>
				q
					.eq("reviewerId", reviewerId)
					.eq("status", status)
					.lte("startDate", endDate),
			)
			.order("desc")
			.take(2);
		const candidate = latest.find((row) => row._id !== excludeAbsenceId);
		if (candidate) candidates.push(candidate);
	}
	return candidates;
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

		const existing = await findOverlapCandidates(ctx, reviewerId, endDate);
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
			const others = await findOverlapCandidates(
				ctx,
				absence.reviewerId,
				endDate,
				absenceId,
			);
			if (
				others.some((other) =>
					dateKeyRangesOverlap({ startDate, endDate }, other),
				)
			) {
				throw new Error(plannedAbsenceErrorMessage("overlap"));
			}

			await ctx.db.patch(absenceId, { endDate, updatedAt: now });
			const nextAbsentUntil = resolveUpdatedAbsentUntil({
				isAbsent: reviewer.isAbsent,
				absentUntil: reviewer.absentUntil,
				previousReturnAt: getAbsenceReturnAt(absence.endDate, timeZone),
				nextReturnAt: getAbsenceReturnAt(endDate, timeZone),
			});
			if (nextAbsentUntil !== null) {
				await ctx.db.patch(reviewer._id, { absentUntil: nextAbsentUntil });
			}
			await createSnapshot(
				ctx,
				absence.teamId,
				`Updated planned absence for ${reviewer.name} ${describeRange(startDate, endDate)}`,
			);
			return { status: "active" as const };
		}

		const others = await findOverlapCandidates(
			ctx,
			absence.reviewerId,
			endDate,
			absenceId,
		);
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

// Starts scheduled absences whose start date has arrived in their team's
// timezone, and closes active ones whose end has passed without the reviewer
// being returned (indefinite or longer manual absence).
export const processPlannedAbsences = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		// Cheap superset: the earliest timezone on Earth reaches each date first.
		const earliestToday = getTodayDateKey(now, EARLIEST_TODAY_TIMEZONE);

		const teams = new Map<Id<"teams">, Doc<"teams"> | null>();
		const getTimeZone = async (teamId: Id<"teams">) => {
			let team = teams.get(teamId);
			if (team === undefined) {
				team = await ctx.db.get(teamId);
				teams.set(teamId, team);
			}
			return resolveTeamTimezone(team?.timezone);
		};

		let activated = 0;
		let expired = 0;
		let handled = 0;

		// Scanning past not-yet-due rows only costs reads, so they cannot starve
		// due ones; the cap bounds writes and snapshots per transaction.
		const due = ctx.db
			.query("reviewerAbsences")
			.withIndex("by_status_and_startDate", (q) =>
				q.eq("status", "scheduled").lte("startDate", earliestToday),
			);
		for await (const absence of due) {
			const timeZone = await getTimeZone(absence.teamId);
			if (
				compareDateKeys(getTodayDateKey(now, timeZone), absence.startDate) < 0
			) {
				continue;
			}
			if (handled >= MAX_ACTIVATIONS_PER_RUN) {
				await ctx.scheduler.runAfter(
					0,
					internal.absences.processPlannedAbsences,
					{},
				);
				break;
			}
			handled += 1;
			const reviewer = await ctx.db.get(absence.reviewerId);
			if (!reviewer) {
				// Orphaned row; cancel so it cannot linger.
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

		// Active rows whose range ended while the reviewer stayed absent never
		// get completed by a return; close them so they stop reading as current.
		let closed = 0;
		const ended = await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_status_and_endDate", (q) =>
				q.eq("status", "active").lt("endDate", earliestToday),
			)
			.take(MAX_CLOSES_PER_RUN);
		for (const absence of ended) {
			const timeZone = await getTimeZone(absence.teamId);
			if (getAbsenceReturnAt(absence.endDate, timeZone) > now) continue;
			await ctx.db.patch(absence._id, { status: "completed", updatedAt: now });
			closed += 1;
		}

		return { activated, expired, closed };
	},
});
