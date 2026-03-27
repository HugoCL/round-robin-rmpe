import { v } from "convex/values";
import {
	getReviewerAvailability,
	normalizePartTimeSchedule,
	resolveTeamTimezone,
	type Weekday,
} from "../lib/reviewerAvailability";
import { getMemberTeamsForEmail, isAdminEmail, normalizeEmail } from "./authz";

type EnrichedAssignment = {
	_id: Id<"prAssignments">;
	teamId: Id<"teams">;
	prUrl?: string | undefined;
	urgent: boolean;
	crossTeamReview: boolean;
	assigneeId: Id<"reviewers">;
	assignerId: Id<"reviewers">;
	status: string;
	createdAt: number;
	updatedAt: number;
	assigneeName?: string;
	assignerName?: string;
	assigneeEmail?: string;
	assignerEmail?: string;
};

import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";

// Helper: resolve team by slug and optionally create a default one for single-tenant upgrade
async function getTeamBySlugOrThrow(ctx: QueryCtx, teamSlug: string) {
	const team = await ctx.db
		.query("teams")
		.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
		.first();
	if (!team) throw new Error("Team not found");
	return team;
}

type ReviewerDoc = Doc<"reviewers">;
type TeamDoc = Doc<"teams">;
type EventDoc = Doc<"events">;
type EventPerson = {
	reviewerId: Id<"reviewers">;
};
type ResolvedPerson = {
	reviewerId: Id<"reviewers">;
	email: string;
	name: string;
	googleChatUserId?: string;
};
type ResolvedParticipant = ResolvedPerson & { joinedAt: number };
type ResolvedEvent = Omit<EventDoc, "createdBy" | "participants"> & {
	createdBy: ResolvedPerson;
	participants: ResolvedParticipant[];
};
type GroupedAssignmentHistoryItem = {
	id: string;
	batchId?: string;
	timestamp: number;
	forced: boolean;
	skipped: boolean;
	isAbsentSkip: boolean;
	urgent: boolean;
	crossTeamReview: boolean;
	source: "ui" | "agent";
	prUrl?: string;
	contextUrl?: string;
	googleChatThreadUrl?: string;
	actionByReviewerId?: string;
	actionByName?: string;
	actionByEmail?: string;
	reviewers: Array<{
		reviewerId: string;
		reviewerName: string;
		tagId?: string;
		timestamp: number;
	}>;
	reviewerCount: number;
};
type LandingAssignmentTickerItem = {
	id: string;
	teamName: string;
	prNumber?: string;
	assignerName: string;
	assigneeName: string;
	timestamp: number;
};
type UserPreferenceFlags = {
	showAssignments: boolean;
	myAssignmentsOnly: boolean;
	showTags: boolean;
	showEmails: boolean;
	hideMultiAssignmentSection: boolean;
	alwaysSendGoogleChatMessage: boolean;
	enableAgentSetupExperiment: boolean;
	defaultAgentTeamSlug?: string;
};

const USER_PREFERENCE_DEFAULTS: UserPreferenceFlags = {
	showAssignments: false,
	myAssignmentsOnly: false,
	showTags: true,
	showEmails: false,
	hideMultiAssignmentSection: false,
	alwaysSendGoogleChatMessage: false,
	enableAgentSetupExperiment: false,
	defaultAgentTeamSlug: undefined,
};

function selectLatestUserPreference(
	rows: Doc<"userPreferences">[],
): Doc<"userPreferences"> | null {
	if (rows.length === 0) return null;
	return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function buildReviewerMaps(reviewers: ReviewerDoc[]) {
	const byId = new Map<Id<"reviewers">, ReviewerDoc>();
	for (const reviewer of reviewers) {
		byId.set(reviewer._id, reviewer);
	}
	return { byId };
}

function enrichReviewer(
	reviewer: ReviewerDoc,
	team: Pick<TeamDoc, "timezone"> | null,
	now: number,
) {
	const partTimeSchedule = normalizePartTimeSchedule(reviewer.partTimeSchedule);
	return {
		...reviewer,
		partTimeSchedule,
		...getReviewerAvailability(
			{
				isAbsent: reviewer.isAbsent,
				partTimeSchedule,
			},
			resolveTeamTimezone(team?.timezone),
			now,
		),
	};
}

function enrichReviewers(
	reviewers: ReviewerDoc[],
	team: Pick<TeamDoc, "timezone"> | null,
	now: number,
) {
	return reviewers.map((reviewer) => enrichReviewer(reviewer, team, now));
}

function resolveReviewerName(
	reviewerId: string | undefined,
	byId: Map<Id<"reviewers">, ReviewerDoc>,
	fallback?: string,
) {
	if (!reviewerId) return fallback ?? "Unknown";
	const reviewer = byId.get(reviewerId as Id<"reviewers">);
	if (reviewer) return reviewer.name;
	return fallback ?? "Unknown";
}

function resolveReviewerMeta(
	reviewerId: string | undefined,
	byId: Map<Id<"reviewers">, ReviewerDoc>,
	fallbackName?: string,
) {
	if (!reviewerId) return {};
	const reviewer = byId.get(reviewerId as Id<"reviewers">);
	if (reviewer) {
		return {
			actionByName: reviewer.name,
			actionByEmail: reviewer.email,
		};
	}
	if (fallbackName) {
		return { actionByName: fallbackName };
	}
	return {};
}

function resolvePerson(
	person: EventPerson,
	byId: Map<Id<"reviewers">, ReviewerDoc>,
): ResolvedPerson {
	const reviewer = byId.get(person.reviewerId);
	return {
		reviewerId: person.reviewerId,
		email: reviewer?.email ?? "unknown@invalid.local",
		name: reviewer?.name ?? "Unknown",
		googleChatUserId: reviewer?.googleChatUserId?.trim() || undefined,
	};
}

function resolveEvent(
	event: EventDoc,
	byId: Map<Id<"reviewers">, ReviewerDoc>,
): ResolvedEvent {
	const createdBy = resolvePerson(event.createdBy as EventPerson, byId);
	const participants = event.participants.map((participant) => ({
		...resolvePerson(participant as EventPerson, byId),
		joinedAt: participant.joinedAt,
	}));

	return {
		...event,
		createdBy,
		participants,
	};
}

function groupAssignmentHistory(
	history: Doc<"assignmentHistory">[],
	byId: Map<Id<"reviewers">, ReviewerDoc>,
): GroupedAssignmentHistoryItem[] {
	const grouped = new Map<string, GroupedAssignmentHistoryItem>();

	for (const item of history) {
		const key = item.batchId ?? `single:${item._id}`;
		const reviewerName = resolveReviewerName(item.reviewerId, byId);
		const actionBy = resolveReviewerMeta(item.actionByReviewerId, byId);

		if (!grouped.has(key)) {
			grouped.set(key, {
				id: item.batchId ?? String(item._id),
				batchId: item.batchId,
				timestamp: item.timestamp,
				forced: item.forced,
				skipped: item.skipped,
				isAbsentSkip: item.isAbsentSkip,
				urgent: item.urgent === true,
				crossTeamReview: item.crossTeamReview === true,
				source: item.source === "agent" ? "agent" : "ui",
				prUrl: item.prUrl,
				contextUrl: item.contextUrl,
				googleChatThreadUrl: item.googleChatThreadUrl,
				actionByReviewerId: item.actionByReviewerId
					? String(item.actionByReviewerId)
					: undefined,
				...actionBy,
				reviewers: [],
				reviewerCount: 0,
			});
		}

		const group = grouped.get(key);
		if (!group) continue;

		group.timestamp = Math.max(group.timestamp, item.timestamp);
		group.forced = group.forced || item.forced;
		group.skipped = group.skipped || item.skipped;
		group.isAbsentSkip = group.isAbsentSkip || item.isAbsentSkip;
		group.urgent = group.urgent || item.urgent === true;
		group.crossTeamReview =
			group.crossTeamReview || item.crossTeamReview === true;
		group.source =
			group.source === "agent" || item.source === "agent" ? "agent" : "ui";
		group.prUrl ??= item.prUrl;
		group.contextUrl ??= item.contextUrl;
		group.googleChatThreadUrl ??= item.googleChatThreadUrl;
		group.actionByReviewerId ??= item.actionByReviewerId
			? String(item.actionByReviewerId)
			: undefined;
		group.actionByName ??= actionBy.actionByName;
		group.actionByEmail ??= actionBy.actionByEmail;
		group.reviewers.push({
			reviewerId: String(item.reviewerId),
			reviewerName,
			tagId: item.tagId,
			timestamp: item.timestamp,
		});
		group.reviewerCount = group.reviewers.length;
	}

	return Array.from(grouped.values())
		.map((group) => ({
			...group,
			reviewers: [...group.reviewers].sort((a, b) => a.timestamp - b.timestamp),
		}))
		.sort((a, b) => b.timestamp - a.timestamp);
}

function extractPrNumber(prUrl?: string) {
	if (!prUrl) return undefined;
	const match = prUrl.match(/(?:pull|pulls|merge_requests)\/(\d+)(?:[/?#]|$)/i);
	if (match?.[1]) return match[1];

	const fallbackMatch = prUrl.match(/\/(\d+)(?:[/?#]|$)/);
	return fallbackMatch?.[1];
}

const WEEKDAY_TO_MONDAY_INDEX: Record<Weekday, number> = {
	monday: 0,
	tuesday: 1,
	wednesday: 2,
	thursday: 3,
	friday: 4,
	saturday: 5,
	sunday: 6,
};

function parseGmtOffsetToMs(value: string) {
	if (value === "GMT") return 0;

	const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
	if (!match) {
		throw new Error(`Unsupported timezone offset format: ${value}`);
	}

	const sign = match[1] === "+" ? 1 : -1;
	const hours = Number.parseInt(match[2], 10);
	const minutes = Number.parseInt(match[3] ?? "0", 10);
	return sign * (hours * 60 + minutes) * 60 * 1000;
}

function getTimeZoneOffsetMs(timeZone: string, timestamp: number) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		timeZoneName: "shortOffset",
	}).formatToParts(new Date(timestamp));
	const offsetText = parts.find((part) => part.type === "timeZoneName")?.value;

	if (!offsetText) {
		throw new Error(`Unable to resolve timezone offset for ${timeZone}`);
	}

	return parseGmtOffsetToMs(offsetText);
}

function getTimeZoneDateParts(
	now: number,
	timeZone: string,
): {
	year: number;
	month: number;
	day: number;
	weekday: Weekday;
} {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "long",
	}).formatToParts(new Date(now));

	const year = Number.parseInt(
		parts.find((part) => part.type === "year")?.value ?? "0",
		10,
	);
	const month = Number.parseInt(
		parts.find((part) => part.type === "month")?.value ?? "0",
		10,
	);
	const day = Number.parseInt(
		parts.find((part) => part.type === "day")?.value ?? "0",
		10,
	);
	const weekdayText = (
		parts.find((part) => part.type === "weekday")?.value ?? ""
	).toLowerCase();

	if (
		Number.isNaN(year) ||
		Number.isNaN(month) ||
		Number.isNaN(day) ||
		!(weekdayText in WEEKDAY_TO_MONDAY_INDEX)
	) {
		throw new Error(`Unable to parse timezone date parts for ${timeZone}`);
	}

	return {
		year,
		month,
		day,
		weekday: weekdayText as Weekday,
	};
}

function zonedDateTimeToUtcMs(
	timeZone: string,
	parts: {
		year: number;
		month: number;
		day: number;
		hour?: number;
		minute?: number;
		second?: number;
		millisecond?: number;
	},
) {
	const hour = parts.hour ?? 0;
	const minute = parts.minute ?? 0;
	const second = parts.second ?? 0;
	const millisecond = parts.millisecond ?? 0;

	let candidateUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		hour,
		minute,
		second,
		millisecond,
	);

	for (let i = 0; i < 3; i += 1) {
		const offset = getTimeZoneOffsetMs(timeZone, candidateUtc);
		const nextCandidate =
			Date.UTC(
				parts.year,
				parts.month - 1,
				parts.day,
				hour,
				minute,
				second,
				millisecond,
			) - offset;
		if (nextCandidate === candidateUtc) {
			break;
		}
		candidateUtc = nextCandidate;
	}

	return candidateUtc;
}

function getCurrentWeekRangeInTimezone(now: number, timeZone: string) {
	const dateParts = getTimeZoneDateParts(now, timeZone);
	const weekDayOffset = WEEKDAY_TO_MONDAY_INDEX[dateParts.weekday];

	const weekStartLocalDate = new Date(
		Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day),
	);
	weekStartLocalDate.setUTCDate(
		weekStartLocalDate.getUTCDate() - weekDayOffset,
	);

	const weekStartMs = zonedDateTimeToUtcMs(timeZone, {
		year: weekStartLocalDate.getUTCFullYear(),
		month: weekStartLocalDate.getUTCMonth() + 1,
		day: weekStartLocalDate.getUTCDate(),
	});

	const weekEndLocalDate = new Date(weekStartLocalDate);
	weekEndLocalDate.setUTCDate(weekEndLocalDate.getUTCDate() + 7);

	const weekEndMs = zonedDateTimeToUtcMs(timeZone, {
		year: weekEndLocalDate.getUTCFullYear(),
		month: weekEndLocalDate.getUTCMonth() + 1,
		day: weekEndLocalDate.getUTCDate(),
	});

	return { weekStartMs, weekEndMs };
}

// Teams
export const getTeams = query({
	args: {},
	handler: async (ctx) => {
		const teams = await ctx.db.query("teams").order("desc").collect();
		return teams;
	},
});

export const getTeamsForUserEmail = query({
	args: { email: v.string() },
	handler: async (ctx, { email }) => {
		return await getMemberTeamsForEmail(ctx, email);
	},
});

export const getMyTeamAccess = query({
	args: { teamSlug: v.optional(v.string()) },
	handler: async (ctx, { teamSlug }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return {
				isAuthenticated: false,
				isAdmin: false,
				memberTeamSlugs: [] as string[],
				canManageCurrentTeam: false,
				isForeignTeam: false,
			};
		}

		const normalizedEmail = normalizeEmail(identity.email);
		const memberTeams = normalizedEmail
			? await getMemberTeamsForEmail(ctx, normalizedEmail)
			: [];
		const memberTeamSlugs = memberTeams
			.map((team) => team.slug)
			.filter((slug): slug is string => typeof slug === "string");
		const isAdmin = isAdminEmail(identity.email);
		const isMemberOfCurrentTeam =
			typeof teamSlug === "string" ? memberTeamSlugs.includes(teamSlug) : false;

		return {
			isAuthenticated: true,
			isAdmin,
			memberTeamSlugs,
			canManageCurrentTeam: isAdmin || isMemberOfCurrentTeam,
			isForeignTeam:
				typeof teamSlug === "string"
					? !isAdmin && !isMemberOfCurrentTeam
					: false,
		};
	},
});

export const getMyOnboardingState = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return {
				isAuthenticated: false,
				isAdmin: false,
				hasTeams: false,
				memberTeamSlugs: [] as string[],
				joinableTeams: [] as Doc<"teams">[],
			};
		}

		const normalizedEmail = normalizeEmail(identity.email);
		const memberTeams = normalizedEmail
			? await getMemberTeamsForEmail(ctx, normalizedEmail)
			: [];
		const memberTeamSlugs = memberTeams
			.map((team) => team.slug)
			.filter((slug): slug is string => typeof slug === "string");
		const allTeams = await ctx.db.query("teams").order("desc").collect();
		const joinableTeams = allTeams.filter(
			(team) => !memberTeamSlugs.includes(team.slug),
		);

		return {
			isAuthenticated: true,
			isAdmin: isAdminEmail(identity.email),
			hasTeams: memberTeamSlugs.length > 0,
			memberTeamSlugs,
			joinableTeams,
		};
	},
});

export const getGlobalReviewedPRCount = query({
	args: {},
	handler: async (ctx) => {
		const metrics = await ctx.db
			.query("appMetrics")
			.withIndex("by_key", (q) => q.eq("key", "reviewed_pr_total"))
			.collect();

		return metrics.reduce((total, metric) => total + metric.value, 0);
	},
});

export const getLandingAssignmentTicker = query({
	args: {},
	handler: async (ctx) => {
		const recentHistory = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_timestamp")
			.order("desc")
			.take(10);

		const groupedAssignments = new Map<
			string,
			{
				id: string;
				teamId?: Id<"teams">;
				prUrl?: string;
				actionByName?: string;
				actionByReviewerId?: Id<"reviewers">;
				reviewers: Array<{
					reviewerId: Id<"reviewers">;
					reviewerName?: string;
				}>;
				timestamp: number;
			}
		>();

		for (const assignment of recentHistory) {
			if (assignment.skipped || assignment.isAbsentSkip || !assignment.teamId) {
				continue;
			}

			const key = assignment.batchId ?? `single:${assignment._id}`;
			const existing = groupedAssignments.get(key);
			if (existing) {
				existing.timestamp = Math.max(existing.timestamp, assignment.timestamp);
				existing.prUrl ??= assignment.prUrl;
				existing.reviewers.push({
					reviewerId: assignment.reviewerId,
					reviewerName: assignment.reviewerName,
				});
				continue;
			}

			groupedAssignments.set(key, {
				id: assignment.batchId ?? String(assignment._id),
				teamId: assignment.teamId,
				prUrl: assignment.prUrl,
				actionByName: assignment.actionByName,
				actionByReviewerId: assignment.actionByReviewerId,
				reviewers: [
					{
						reviewerId: assignment.reviewerId,
						reviewerName: assignment.reviewerName,
					},
				],
				timestamp: assignment.timestamp,
			});
		}

		const standardAssignments = Array.from(groupedAssignments.values())
			.filter((assignment) => assignment.reviewers.length === 1)
			.sort((a, b) => b.timestamp - a.timestamp)
			.slice(0, 18);

		const uniqueTeamIds = [
			...new Set(
				standardAssignments
					.map((item) => item.teamId)
					.filter((teamId): teamId is Id<"teams"> => teamId !== undefined),
			),
		];
		const uniqueReviewerIds = [
			...new Set(
				standardAssignments.flatMap((item) =>
					[
						...item.reviewers.map((reviewer) => reviewer.reviewerId),
						item.actionByReviewerId,
					].filter(
						(reviewerId): reviewerId is Id<"reviewers"> =>
							reviewerId !== undefined,
					),
				),
			),
		];

		const [teams, reviewers] = await Promise.all([
			Promise.all(uniqueTeamIds.map((teamId) => ctx.db.get(teamId))),
			Promise.all(
				uniqueReviewerIds.map((reviewerId) => ctx.db.get(reviewerId)),
			),
		]);

		const teamById = new Map<Id<"teams">, TeamDoc>();
		for (const team of teams) {
			if (team) {
				teamById.set(team._id, team);
			}
		}

		const reviewerById = new Map<Id<"reviewers">, ReviewerDoc>();
		for (const reviewer of reviewers) {
			if (reviewer) {
				reviewerById.set(reviewer._id, reviewer);
			}
		}

		return standardAssignments.reduce<LandingAssignmentTickerItem[]>(
			(items, assignment) => {
				if (!assignment.teamId) return items;

				const teamName = teamById.get(assignment.teamId)?.name;
				if (!teamName) return items;

				const assignee = assignment.reviewers[0];
				if (!assignee) return items;

				const assigneeName =
					assignee.reviewerName ||
					reviewerById.get(assignee.reviewerId)?.name ||
					"Unknown";
				const assignerName =
					assignment.actionByName ||
					(assignment.actionByReviewerId
						? reviewerById.get(assignment.actionByReviewerId)?.name
						: undefined) ||
					"Unknown";

				items.push({
					id: assignment.id,
					teamName,
					prNumber: extractPrNumber(assignment.prUrl),
					assignerName,
					assigneeName,
					timestamp: assignment.timestamp,
				});
				return items;
			},
			[],
		);
	},
});

export const getTeam = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await ctx.db
			.query("teams")
			.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
			.first();
		if (!team) return null;
		return {
			...team,
			timezone: resolveTeamTimezone(team.timezone),
		};
	},
});

export const getTeamWeeklyPrCount = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const timeZone = resolveTeamTimezone(team.timezone);
		const { weekStartMs, weekEndMs } = getCurrentWeekRangeInTimezone(
			Date.now(),
			timeZone,
		);

		const weeklyRows = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) =>
				q
					.eq("teamId", team._id)
					.gte("timestamp", weekStartMs)
					.lt("timestamp", weekEndMs),
			)
			.collect();

		const uniqueAssignedPrKeys = new Set<string>();
		for (const row of weeklyRows) {
			if (!row.skipped && !row.isAbsentSkip) {
				const normalizedPrUrl = row.prUrl?.trim().toLowerCase();
				if (normalizedPrUrl) {
					uniqueAssignedPrKeys.add(`pr:${normalizedPrUrl}`);
					continue;
				}

				if (row.batchId) {
					uniqueAssignedPrKeys.add(`batch:${row.batchId}`);
					continue;
				}

				uniqueAssignedPrKeys.add(`single:${row._id}`);
			}
		}

		const count = uniqueAssignedPrKeys.size;

		return {
			count,
			weekStartMs,
			weekEndMs,
			timeZone,
		};
	},
});

export const getMyUserPreferences = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return {
				...USER_PREFERENCE_DEFAULTS,
				isAuthenticated: false,
				exists: false,
			};
		}

		const existingRows = await ctx.db
			.query("userPreferences")
			.withIndex("by_user_token_identifier", (q) =>
				q.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.collect();
		const existing = selectLatestUserPreference(existingRows);

		if (!existing) {
			return {
				...USER_PREFERENCE_DEFAULTS,
				isAuthenticated: true,
				exists: false,
			};
		}

		return {
			showAssignments: existing.showAssignments,
			myAssignmentsOnly: existing.myAssignmentsOnly === true,
			showTags: existing.showTags,
			showEmails: existing.showEmails,
			hideMultiAssignmentSection: existing.hideMultiAssignmentSection,
			alwaysSendGoogleChatMessage: existing.alwaysSendGoogleChatMessage,
			enableAgentSetupExperiment: existing.enableAgentSetupExperiment === true,
			defaultAgentTeamSlug: existing.defaultAgentTeamSlug,
			isAuthenticated: true,
			exists: true,
		};
	},
});

// Reviewer queries
export const getReviewers = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		return enrichReviewers(reviewers, team, Date.now());
	},
});

export const getTags = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		return await ctx.db
			.query("tags")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
	},
});

export const getAssignmentFeed = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const feed = await ctx.db
			.query("assignmentFeed")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.first();
		if (!feed) return { items: [], lastAssigned: null };
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);

		return {
			...feed,
			items: feed.items.map((item) => ({
				...item,
				urgent: item.urgent === true,
				crossTeamReview: item.crossTeamReview === true,
				source: item.source === "agent" ? "agent" : "ui",
				reviewerName: resolveReviewerName(
					item.reviewerId,
					byId,
					item.reviewerName,
				),
				...resolveReviewerMeta(
					item.actionByReviewerId,
					byId,
					item.actionByName,
				),
			})),
		};
	},
});

// Get assignment history for display, grouped by multi-assignment batch when present.
export const getAssignmentHistory = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const history = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.order("desc")
			.take(30);
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);

		return groupAssignmentHistory(history, byId);
	},
});

// Check if a PR has been previously assigned
export const checkPRAlreadyAssigned = query({
	args: { teamSlug: v.string(), prUrl: v.string() },
	handler: async (ctx, { teamSlug, prUrl }) => {
		if (!prUrl.trim()) return null;

		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const feed = await ctx.db
			.query("assignmentFeed")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.first();

		if (!feed) return null;

		// Search for matching prUrl in the feed items
		const normalizedPrUrl = prUrl.trim().toLowerCase();
		const existingAssignment = feed.items.find(
			(item) => item.prUrl?.trim().toLowerCase() === normalizedPrUrl,
		);

		if (!existingAssignment) return null;

		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);

		return {
			reviewerName: resolveReviewerName(existingAssignment.reviewerId, byId),
			timestamp: existingAssignment.timestamp,
		};
	},
});

// Get next reviewer for regular assignment
export const getNextReviewer = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const enrichedReviewers = enrichReviewers(reviewers, team, Date.now());

		if (enrichedReviewers.length === 0) {
			return null;
		}

		// Find available reviewers (not absent)
		const availableReviewers = enrichedReviewers.filter(
			(reviewer) => !reviewer.effectiveIsAbsent,
		);

		if (availableReviewers.length > 0) {
			// Find the minimum assignment count among available reviewers
			const minCount = Math.min(
				...availableReviewers.map((r) => r.assignmentCount),
			);

			// Get all available reviewers with the minimum count
			const candidatesWithMinCount = availableReviewers.filter(
				(r) => r.assignmentCount === minCount,
			);

			// Sort by creation time (older first)
			const sortedCandidates = [...candidatesWithMinCount].sort(
				(a, b) => a.createdAt - b.createdAt,
			);

			return sortedCandidates[0];
		}

		return null;
	},
});

// Get next reviewer by tag
export const getNextReviewerByTag = query({
	args: { teamSlug: v.string(), tagId: v.id("tags") },
	handler: async (ctx, { teamSlug, tagId }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const enrichedReviewers = enrichReviewers(allReviewers, team, Date.now());

		// Filter for available reviewers with the specific tag
		const availableReviewers = enrichedReviewers.filter(
			(reviewer) =>
				!reviewer.effectiveIsAbsent && reviewer.tags.includes(tagId),
		);

		if (availableReviewers.length === 0) {
			return null;
		}

		// Find the minimum assignment count among available reviewers
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);

		// Get all available reviewers with the minimum count
		const candidatesWithMinCount = availableReviewers.filter(
			(r) => r.assignmentCount === minCount,
		);

		// Sort by creation time (older first)
		const sortedCandidates = [...candidatesWithMinCount].sort(
			(a, b) => a.createdAt - b.createdAt,
		);

		return sortedCandidates[0];
	},
});

// Get reviewer by id
export const getReviewerById = query({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		try {
			const reviewer = await ctx.db.get(id as Id<"reviewers">);

			if (!reviewer || !("email" in reviewer)) {
				return null;
			}

			const team =
				reviewer.teamId === undefined
					? null
					: await ctx.db.get(reviewer.teamId);
			return enrichReviewer(reviewer, team, Date.now());
		} catch {
			return null;
		}
	},
});

// Get tag by id
export const getTagById = query({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		try {
			const tag = await ctx.db.get(id as Id<"tags">);

			if (!tag || !("color" in tag)) {
				return null;
			}

			return {
				id: tag._id,
				name: tag.name,
				color: tag.color,
				description: tag.description,
				createdAt: tag.createdAt,
			};
		} catch {
			return null;
		}
	},
});

// Get all backup snapshots
export const getBackups = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const backups = await ctx.db
			.query("backups")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.order("desc")
			.collect();

		return backups.map((backup) => ({
			key: backup._id,
			description: backup.reason,
			timestamp: backup.createdAt,
		}));
	},
});

// Last 3 debug messages (for troubleshooting sent chat message formatting)
export const getLastMessages = query({
	args: {},
	handler: async (ctx) => {
		const messages = await ctx.db
			.query("debugMessages")
			.withIndex("by_created_at")
			.order("desc")
			.take(3);
		return messages;
	},
});

// Active PR assignments for a reviewer (as assignee)
export const getActiveAssignmentsForReviewer = query({
	args: { teamSlug: v.string(), email: v.string() },
	handler: async (ctx, { teamSlug, email }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Find reviewer by email
		const reviewer = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", team._id).eq("email", email.toLowerCase()),
			)
			.first();
		if (!reviewer) return [];
		const rows = await ctx.db
			.query("prAssignments")
			.withIndex("by_assignee", (q) => q.eq("assigneeId", reviewer._id))
			.collect();
		const enriched: EnrichedAssignment[] = [];
		for (const row of rows) {
			if (row.teamId !== team._id) continue;
			const assignee = await ctx.db.get(row.assigneeId as Id<"reviewers">);
			const assigner = await ctx.db.get(row.assignerId as Id<"reviewers">);
			enriched.push({
				_id: row._id,
				teamId: row.teamId as Id<"teams">,
				prUrl: row.prUrl,
				urgent: row.urgent === true,
				crossTeamReview: row.crossTeamReview === true,
				assigneeId: row.assigneeId as Id<"reviewers">,
				assignerId: row.assignerId as Id<"reviewers">,
				status: "pending", // flattened model: treat existing row as pending until completion
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				assigneeName:
					assignee && "name" in assignee ? assignee.name : undefined,
				assignerName:
					assigner && "name" in assigner ? assigner.name : undefined,
				assigneeEmail:
					assignee && "email" in assignee ? assignee.email : undefined,
				assignerEmail:
					assigner && "email" in assigner ? assigner.email : undefined,
			});
		}
		return enriched;
	},
});

// Active PR assignments created by reviewer (as assigner)
export const getActiveAssignmentsByReviewer = query({
	args: { teamSlug: v.string(), email: v.string() },
	handler: async (ctx, { teamSlug, email }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Find reviewer by email
		const reviewer = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", team._id).eq("email", email.toLowerCase()),
			)
			.first();
		if (!reviewer) return [];
		const rows = await ctx.db
			.query("prAssignments")
			.withIndex("by_assigner", (q) => q.eq("assignerId", reviewer._id))
			.collect();
		const enriched: EnrichedAssignment[] = [];
		for (const row of rows) {
			if (row.teamId !== team._id) continue;
			const assignee = await ctx.db.get(row.assigneeId as Id<"reviewers">);
			const assigner = await ctx.db.get(row.assignerId as Id<"reviewers">);
			enriched.push({
				_id: row._id,
				teamId: row.teamId as Id<"teams">,
				prUrl: row.prUrl,
				urgent: row.urgent === true,
				crossTeamReview: row.crossTeamReview === true,
				assigneeId: row.assigneeId as Id<"reviewers">,
				assignerId: row.assignerId as Id<"reviewers">,
				status: "pending",
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				assigneeName:
					assignee && "name" in assignee ? assignee.name : undefined,
				assignerName:
					assigner && "name" in assigner ? assigner.name : undefined,
				assigneeEmail:
					assignee && "email" in assignee ? assignee.email : undefined,
				assignerEmail:
					assigner && "email" in assigner ? assigner.email : undefined,
			});
		}
		return enriched;
	},
});

// Get all active (scheduled or started) events for a team
export const getActiveEvents = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const events = await ctx.db
			.query("events")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);

		// Filter for active events and sort by scheduled time
		return events
			.filter((e) => e.status === "scheduled" || e.status === "started")
			.sort((a, b) => a.scheduledAt - b.scheduledAt)
			.map((event) => resolveEvent(event, byId));
	},
});

// Get upcoming events (scheduled, not yet started)
export const getUpcomingEvents = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const events = await ctx.db
			.query("events")
			.withIndex("by_team_status", (q) =>
				q.eq("teamId", team._id).eq("status", "scheduled"),
			)
			.collect();
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);

		return events
			.sort((a, b) => a.scheduledAt - b.scheduledAt)
			.map((event) => resolveEvent(event, byId));
	},
});

// Get a single event by ID
export const getEventById = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) return null;
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", event.teamId))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);
		return resolveEvent(event, byId);
	},
});

// Get event with team info (for join page)
export const getEventWithTeam = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) return null;

		const team = await ctx.db.get(event.teamId);
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", event.teamId))
			.collect();
		const { byId } = buildReviewerMaps(reviewers);
		const resolvedEvent = resolveEvent(event, byId);
		return {
			event: resolvedEvent,
			team: team ? { name: team.name, slug: team.slug } : null,
		};
	},
});

// Get events that need start notification (scheduled time has passed)
export const getEventsNeedingStartNotification = query({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Optimized: Use composite index to filter directly in DB instead of in memory
		// This dramatically reduces bandwidth by only fetching events that actually need notification
		const events = await ctx.db
			.query("events")
			.withIndex("by_status_notification_scheduled", (q) =>
				q.eq("status", "scheduled").eq("startNotificationSentAt", undefined),
			)
			.filter((q) => q.lte(q.field("scheduledAt"), now))
			.collect();

		return events;
	},
});
