import {
	getAbsenceReturnAt,
	resolveActivatedAbsentUntil,
} from "../lib/plannedAbsences";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Rows handled per transaction-safe batch when draining a reviewer's absences. */
const DRAIN_BATCH_SIZE = 100;

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
	let completed = 0;
	// Completed rows leave the "active" range, so each pass sees fresh rows.
	while (true) {
		const batch = await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_reviewerId_and_status_and_startDate", (q) =>
				q.eq("reviewerId", reviewerId).eq("status", "active"),
			)
			.take(DRAIN_BATCH_SIZE);
		for (const absence of batch) {
			await ctx.db.patch(absence._id, { status: "completed", updatedAt: now });
		}
		completed += batch.length;
		if (batch.length < DRAIN_BATCH_SIZE) return completed;
	}
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
		while (true) {
			const batch = await ctx.db
				.query("reviewerAbsences")
				.withIndex("by_reviewerId_and_status_and_startDate", (q) =>
					q.eq("reviewerId", reviewerId).eq("status", status),
				)
				.take(DRAIN_BATCH_SIZE);
			for (const row of batch) {
				await ctx.db.delete(row._id);
			}
			if (batch.length < DRAIN_BATCH_SIZE) break;
		}
	}
}
