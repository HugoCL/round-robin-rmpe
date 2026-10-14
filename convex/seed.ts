import { v } from "convex/values";
import { addDaysToDateKey, getTodayDateKey } from "../lib/plannedAbsences";
import {
	DEFAULT_TEAM_TIMEZONE,
	getMonthDayInTimeZone,
} from "../lib/reviewerAvailability";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { activateAbsence } from "./absenceLifecycle";
import { getResolvedAppSettings } from "./appSettings";
import { normalizeEmail } from "./authz";

/**
 * Demo data for local development. Each run deletes and recreates only the
 * teams below, matched by slug, so the deployment's real teams are untouched.
 *
 *   pnpm seed '{"ownerEmail": "you@example.com"}'
 *
 * `ownerEmail` joins every demo team as owner: team access is resolved by the
 * signed-in email, so without it only app admins can open the demo teams.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const OWNER_ASSIGNMENT_COUNT = 5;
const DEMO_PR_BASE_URL = "https://github.com/acme/la-lista/pull";

type ReviewerSeed = Pick<
	Doc<"reviewers">,
	"name" | "email" | "assignmentCount"
> &
	Partial<
		Pick<
			Doc<"reviewers">,
			| "isAbsent"
			| "absentUntil"
			| "excludedFromReviewPool"
			| "includedInTagRotations"
			| "partTimeSchedule"
			| "birthdayMonth"
			| "birthdayDay"
			| "role"
		>
	> & { key: string; tagNames?: string[] };

type HistorySeed = Partial<
	Pick<Doc<"assignmentHistory">, "forced" | "skipped" | "urgent" | "source">
> & {
	reviewerKey: string;
	hoursAgo: number;
	prNumber?: number;
	tagName?: string;
};

type TeamSeed = {
	name: string;
	slug: string;
	tags: Array<Pick<Doc<"tags">, "name" | "color" | "description">>;
	reviewers: ReviewerSeed[];
	history: HistorySeed[];
	/** `startsInDays <= 0` starts the plan now, as the planned-absence cron would. */
	plannedAbsences?: Array<{
		reviewerKey: string;
		startsInDays: number;
		lengthDays: number;
	}>;
	event?: {
		title: string;
		description: string;
		startsInHours: number;
		participantKeys: string[];
	};
};

function demoTeams(now: number): TeamSeed[] {
	const today = getMonthDayInTimeZone(now, DEFAULT_TEAM_TIMEZONE);

	return [
		{
			name: "Demo Plataforma",
			slug: "demo-plataforma",
			tags: [
				{ name: "Frontend", color: "#3B82F6", description: "React y Next.js" },
				{ name: "Backend", color: "#10B981", description: "Convex y APIs" },
				{ name: "Mobile", color: "#8B5CF6" },
			],
			reviewers: [
				{
					key: "valentina",
					name: "Valentina Herrera",
					email: "valentina.herrera@example.com",
					assignmentCount: 6,
					tagNames: ["Frontend"],
				},
				{
					key: "joaquin",
					name: "Joaquín Morales",
					email: "joaquin.morales@example.com",
					assignmentCount: 5,
					tagNames: ["Backend"],
				},
				{
					key: "antonia",
					name: "Antonia Silva",
					email: "antonia.silva@example.com",
					assignmentCount: 6,
					tagNames: ["Frontend", "Mobile"],
					birthdayMonth: today.month,
					birthdayDay: today.day,
				},
				{
					key: "martin",
					name: "Martín Reyes",
					email: "martin.reyes@example.com",
					assignmentCount: 5,
					tagNames: ["Backend"],
					isAbsent: true,
					absentUntil: now + 3 * DAY_MS,
				},
				{
					key: "catalina",
					name: "Catalina Torres",
					email: "catalina.torres@example.com",
					assignmentCount: 3,
					partTimeSchedule: { workingDays: ["monday", "wednesday", "friday"] },
				},
				{
					key: "benjamin",
					name: "Benjamín Araya",
					email: "benjamin.araya@example.com",
					assignmentCount: 2,
					tagNames: ["Mobile"],
					excludedFromReviewPool: true,
					includedInTagRotations: true,
				},
			],
			history: [
				{ reviewerKey: "valentina", hoursAgo: 1, prNumber: 4812, urgent: true },
				{
					reviewerKey: "joaquin",
					hoursAgo: 3,
					prNumber: 4809,
					tagName: "Backend",
				},
				{ reviewerKey: "antonia", hoursAgo: 5, skipped: true },
				{ reviewerKey: "catalina", hoursAgo: 24, prNumber: 4801 },
				{
					reviewerKey: "valentina",
					hoursAgo: 27,
					prNumber: 4797,
					forced: true,
				},
				{
					reviewerKey: "joaquin",
					hoursAgo: 49,
					prNumber: 4790,
					source: "agent",
				},
				{ reviewerKey: "martin", hoursAgo: 74, prNumber: 4781 },
			],
			plannedAbsences: [
				{ reviewerKey: "valentina", startsInDays: -2, lengthDays: 5 },
				{ reviewerKey: "joaquin", startsInDays: 7, lengthDays: 5 },
				{ reviewerKey: "antonia", startsInDays: 8, lengthDays: 3 },
				{ reviewerKey: "catalina", startsInDays: 16, lengthDays: 10 },
			],
			event: {
				title: "Planning del sprint",
				description: "Revisión del backlog y estimación",
				startsInHours: 20,
				participantKeys: ["valentina", "joaquin"],
			},
		},
		{
			name: "Demo Pagos",
			slug: "demo-pagos",
			tags: [{ name: "API", color: "#F59E0B" }],
			reviewers: [
				{
					key: "sofia",
					name: "Sofía Castro",
					email: "sofia.castro@example.com",
					assignmentCount: 2,
					tagNames: ["API"],
				},
				{
					key: "matias",
					name: "Matías González",
					email: "matias.gonzalez@example.com",
					assignmentCount: 2,
				},
				{
					key: "isidora",
					name: "Isidora Navarro",
					email: "isidora.navarro@example.com",
					assignmentCount: 1,
					isAbsent: true,
				},
			],
			history: [
				{ reviewerKey: "sofia", hoursAgo: 6, prNumber: 233, tagName: "API" },
				{ reviewerKey: "matias", hoursAgo: 30, prNumber: 229 },
			],
		},
	];
}

function mustGet<V>(map: Map<string, V>, key: string): V {
	const value = map.get(key);
	if (value === undefined) {
		throw new Error(`Seed references unknown key "${key}"`);
	}
	return value;
}

async function deleteTeam(ctx: MutationCtx, teamId: Id<"teams">) {
	const rows = [
		...(await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("tags")
			.withIndex("by_team", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("assignmentFeed")
			.withIndex("by_team", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("prAssignments")
			.withIndex("by_team", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("events")
			.withIndex("by_team", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("reviewerAbsences")
			.withIndex("by_teamId_and_status", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("backups")
			.withIndex("by_team", (q) => q.eq("teamId", teamId))
			.collect()),
		...(await ctx.db
			.query("featureFlags")
			.withIndex("by_team_status_created_at", (q) => q.eq("teamId", teamId))
			.collect()),
	];
	for (const row of rows) {
		await ctx.db.delete(row._id);
	}
	await ctx.db.delete(teamId);
}

async function insertTeam(
	ctx: MutationCtx,
	seed: TeamSeed,
	ownerEmail: string | null,
	now: number,
) {
	const { ops } = await getResolvedAppSettings(ctx);
	const teamId = await ctx.db.insert("teams", {
		name: seed.name,
		slug: seed.slug,
		createdAt: now,
		timezone: DEFAULT_TEAM_TIMEZONE,
	});

	const tagIds = new Map<string, Id<"tags">>();
	for (const tag of seed.tags) {
		tagIds.set(
			tag.name,
			await ctx.db.insert("tags", { ...tag, teamId, createdAt: now }),
		);
	}

	const reviewerSeeds: ReviewerSeed[] = ownerEmail
		? [
				...seed.reviewers,
				{
					key: "owner",
					name: ownerEmail.split("@")[0],
					email: ownerEmail,
					assignmentCount: OWNER_ASSIGNMENT_COUNT,
					role: "owner",
				},
			]
		: seed.reviewers;
	const reviewers = new Map<string, { id: Id<"reviewers">; name: string }>();
	for (const { key, tagNames = [], ...reviewer } of reviewerSeeds) {
		const id = await ctx.db.insert("reviewers", {
			isAbsent: false,
			...reviewer,
			teamId,
			createdAt: now,
			tags: tagNames.map((name) => mustGet(tagIds, name)),
		});
		reviewers.set(key, { id, name: reviewer.name });
	}

	const history = seed.history.map(
		({ reviewerKey, hoursAgo, prNumber, tagName, ...flags }) => {
			const reviewer = mustGet(reviewers, reviewerKey);
			return {
				reviewerId: reviewer.id,
				reviewerName: reviewer.name,
				timestamp: now - hoursAgo * HOUR_MS,
				forced: false,
				skipped: false,
				isAbsentSkip: false,
				urgent: false,
				source: "ui" as const,
				...flags,
				prUrl: prNumber ? `${DEMO_PR_BASE_URL}/${prNumber}` : undefined,
				tagId: tagName ? mustGet(tagIds, tagName) : undefined,
			};
		},
	);
	for (const item of history) {
		await ctx.db.insert("assignmentHistory", {
			...item,
			teamId,
			reviewerTeamId: teamId,
		});
	}
	const feedItems = history
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, ops.assignmentFeedLength);
	await ctx.db.insert("assignmentFeed", {
		teamId,
		items: feedItems,
		lastAssigned: feedItems[0]?.reviewerId,
	});

	for (const plan of seed.plannedAbsences ?? []) {
		const reviewerId = mustGet(reviewers, plan.reviewerKey).id;
		const startDate = addDaysToDateKey(
			getTodayDateKey(now, DEFAULT_TEAM_TIMEZONE),
			plan.startsInDays,
		);
		const absenceId = await ctx.db.insert("reviewerAbsences", {
			teamId,
			reviewerId,
			startDate,
			endDate: addDaysToDateKey(startDate, plan.lengthDays - 1),
			status: "scheduled",
			createdAt: now,
			updatedAt: now,
		});
		if (plan.startsInDays <= 0) {
			const absence = await ctx.db.get(absenceId);
			const reviewer = await ctx.db.get(reviewerId);
			if (absence && reviewer) {
				await activateAbsence(
					ctx,
					absence,
					reviewer,
					DEFAULT_TEAM_TIMEZONE,
					now,
				);
			}
		}
	}

	if (seed.event) {
		const { title, description, startsInHours, participantKeys } = seed.event;
		const participantIds = participantKeys.map(
			(key) => mustGet(reviewers, key).id,
		);
		await ctx.db.insert("events", {
			teamId,
			title,
			description,
			scheduledAt: now + startsInHours * HOUR_MS,
			durationMinutes: ops.defaultEventDurationMinutes,
			createdAt: now,
			createdBy: { reviewerId: participantIds[0] },
			participants: participantIds.map((reviewerId) => ({
				reviewerId,
				joinedAt: now,
			})),
			status: "scheduled",
		});
	}

	return {
		slug: seed.slug,
		reviewers: reviewers.size,
		tags: tagIds.size,
		history: history.length,
	};
}

export const seed = internalMutation({
	args: { ownerEmail: v.optional(v.string()) },
	handler: async (ctx, { ownerEmail }) => {
		const now = Date.now();
		const normalizedOwnerEmail = normalizeEmail(ownerEmail);
		const seeded = [];
		for (const team of demoTeams(now)) {
			const existing = await ctx.db
				.query("teams")
				.withIndex("by_slug", (q) => q.eq("slug", team.slug))
				.first();
			if (existing) {
				await deleteTeam(ctx, existing._id);
			}
			seeded.push(await insertTeam(ctx, team, normalizedOwnerEmail, now));
		}
		return seeded;
	},
});
