import {
	getAbsenceReturnAt,
	resolveActivatedAbsentUntil,
} from "../lib/plannedAbsences";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Upper bound on simultaneously active rows per reviewer (overlap is rejected, so ~1). */
const MAX_ACTIVE_ABSENCES_PER_REVIEWER = 20;
const MAX_ABSENCES_PER_REVIEWER_DELETE_BATCH = 200;

/**
 * Starts a scheduled absence: marks the reviewer absent until the end of the
 * range (never shortening a longer or indefinite manual absence). If the range
 * already ended, the row is completed without touching the reviewer.
 * Callers are responsible for snapshots.
 */
export async function activateAbsence(
	ctx: MutationCtx,
	absence: Doc<"reviewerAbsences">,
	reviewer: Doc<"reviewers">,
	timeZone: string,
	now: number,
): Promise<"activated" | "expired"> {
	const resolution = resolveActivatedAbsentUntil({
		isAbsent: reviewer.isAbsent,
		absentUntil: reviewer.absentUntil,
		returnAt: getAbsenceReturnAt(absence.endDate, timeZone),
		now,
	});
	if (resolution.kind === "expired") {
		await ctx.db.patch(absence._id, { status: "completed", updatedAt: now });
		return "expired";
	}
	await ctx.db.patch(reviewer._id, {
		isAbsent: true,
		absentUntil: resolution.absentUntil,
	});
	await ctx.db.patch(absence._id, { status: "active", updatedAt: now });
	return "activated";
}

/** Marks every active absence of the reviewer completed; returns how many. */
export async function completeActiveAbsencesForReviewer(
	ctx: MutationCtx,
	reviewerId: Id<"reviewers">,
	now: number,
): Promise<number> {
	const active = await ctx.db
		.query("reviewerAbsences")
		.withIndex("by_reviewerId_and_status", (q) =>
			q.eq("reviewerId", reviewerId).eq("status", "active"),
		)
		.take(MAX_ACTIVE_ABSENCES_PER_REVIEWER);
	for (const absence of active) {
		await ctx.db.patch(absence._id, { status: "completed", updatedAt: now });
	}
	return active.length;
}

/** Deletes every absence row of a reviewer (used when the reviewer is removed). */
export async function deleteAbsencesForReviewer(
	ctx: MutationCtx,
	reviewerId: Id<"reviewers">,
): Promise<void> {
	for (const status of [
		"scheduled",
		"active",
		"completed",
		"cancelled",
	] as const) {
		const rows = await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_reviewerId_and_status", (q) =>
				q.eq("reviewerId", reviewerId).eq("status", status),
			)
			.take(MAX_ABSENCES_PER_REVIEWER_DELETE_BATCH);
		for (const row of rows) {
			await ctx.db.delete(row._id);
		}
	}
}
