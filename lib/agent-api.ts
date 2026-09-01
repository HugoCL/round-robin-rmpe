import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hashAgentToken } from "@/lib/agent-token";
import {
	resolveAgentNotifyFlag,
	shouldQueueAgentAssignmentChat,
} from "@/lib/agentAssignmentChat";
import {
	type AssignmentFailureReason,
	type AssignmentMode,
	type AssignmentSlotInput,
	resolveAssignmentSlots,
} from "@/lib/assignmentResolver";
import {
	resolveBroadcastTeamSlugs,
	resolveNotifiedTeamSlugs,
} from "@/lib/chatBroadcast";
import { buildCrossTeamReviewerPool } from "@/lib/crossTeamPool";
import { isEligibleForAssignment } from "@/lib/reviewerEligibility";

const slotSchema = z.object({
	strategy: z.enum([
		"random",
		"specific",
		"tag_random_selected",
		"tag_random_other",
	]),
	reviewerId: z.string().optional(),
	tagId: z.string().optional(),
});

export const agentAssignmentRequestSchema = z.object({
	teamSlug: z.string().trim().min(1).optional(),
	additionalTeamSlugs: z.array(z.string().trim().min(1)).optional(),
	crossTeamReview: z.boolean().optional(),
	excludeTeammates: z.boolean().optional(),
	selectedTagId: z.string().trim().min(1).optional(),
	prUrl: z.string().trim().min(1).optional(),
	contextUrl: z.string().trim().min(1).optional(),
	contextText: z.string().trim().min(1).optional(),
	urgent: z.boolean().optional(),
	forceDuplicate: z.boolean().optional(),
	notify: z.boolean().optional(),
	slots: z.array(slotSchema).min(1),
});

type AgentAssignmentRequest = z.infer<typeof agentAssignmentRequestSchema>;

export type AuthenticatedAgent = {
	tokenId: Id<"agentTokens">;
	tokenHash: string;
	userTokenIdentifier: string;
	email?: string;
	defaultAgentTeamSlug?: string;
	teams: Array<{
		id: Id<"teams">;
		name: string;
		slug: string;
	}>;
};

type AgentWarning = {
	code: string;
	message: string;
	slotIndex?: number;
};

type AgentTeamSummary = {
	id: string;
	name: string;
	slug: string;
};

type AgentReviewerSummary = {
	id: string;
	name: string;
	email: string;
	assignmentCount: number;
	effectiveIsAbsent: boolean;
	excludedFromReviewPool?: boolean;
	includedInTagRotations?: boolean;
	tags: string[];
};

type AgentTagSummary = {
	id: string;
	name: string;
	color: string;
};

type AgentRecentAssignmentSummary = {
	prUrl?: string;
	reviewerName?: string;
	actionByName?: string;
	timestamp: number;
	urgent: boolean;
	source: "agent" | "ui";
};

type AgentDuplicateSummary = {
	reviewerName?: string;
	timestamp: number;
};

function summarizeTeam(
	team: AuthenticatedAgent["teams"][number],
): AgentTeamSummary {
	return {
		id: String(team.id),
		name: team.name,
		slug: team.slug,
	};
}

function summarizeReviewer(reviewer: {
	_id: string;
	name?: string;
	email?: string;
	assignmentCount?: number;
	effectiveIsAbsent?: boolean;
	excludedFromReviewPool?: boolean;
	includedInTagRotations?: boolean;
	tags?: string[];
}): AgentReviewerSummary {
	return {
		id: String(reviewer._id),
		name: reviewer.name ?? "Unknown",
		email: reviewer.email ?? "",
		assignmentCount: reviewer.assignmentCount ?? 0,
		effectiveIsAbsent: reviewer.effectiveIsAbsent === true,
		excludedFromReviewPool:
			reviewer.excludedFromReviewPool === true ? true : undefined,
		includedInTagRotations: reviewer.includedInTagRotations,
		tags: (reviewer.tags ?? []).map((tagId) => String(tagId)),
	};
}

function summarizeTag(tag: {
	_id: string;
	name?: string;
	color?: string;
}): AgentTagSummary {
	return {
		id: String(tag._id),
		name: tag.name ?? "",
		color: tag.color ?? "",
	};
}

function summarizeRecentAssignments(
	items: Array<{
		prUrl?: string;
		reviewerName?: string;
		actionByName?: string;
		timestamp: number;
		urgent?: boolean;
		source?: string;
	}>,
	limit = 15,
): AgentRecentAssignmentSummary[] {
	return items.slice(0, limit).map((item) => ({
		prUrl: item.prUrl,
		reviewerName: item.reviewerName,
		actionByName: item.actionByName,
		timestamp: item.timestamp,
		urgent: item.urgent === true,
		source: item.source === "agent" ? "agent" : "ui",
	}));
}

type TeamResolution =
	| {
			error: Response;
	  }
	| {
			error: null;
			selectedTeam: AuthenticatedAgent["teams"][number] | null;
			defaultTeamSlug?: string;
			warnings: AgentWarning[];
	  };

export type AgentResult<T> =
	| {
			error: Response;
	  }
	| {
			body: T;
			tokenId: Id<"agentTokens">;
	  };

function jsonError(status: number, code: string, message: string) {
	return Response.json(
		{
			error: {
				code,
				message,
			},
		},
		{ status },
	);
}

function normalizeOptionalText(value?: string) {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

const PULL_REQUEST_URL_PATTERN =
	/https?:\/\/[^\s<>"'`|)]+\/(?:pull|pulls|merge_requests)\/\d+(?:[/?#][^\s<>"'`|)]*)?/i;

function extractPullRequestUrl(value?: string) {
	const normalized = normalizeOptionalText(value);
	if (!normalized) return undefined;

	const match = normalized.match(PULL_REQUEST_URL_PATTERN);
	if (!match) return undefined;

	return match[0].replace(/[.,;!?]+$/, "");
}

function resolveRequestedPrUrl(input: {
	prUrl?: string;
	contextUrl?: string;
	contextText?: string;
}) {
	const explicitPrUrl = normalizeOptionalText(input.prUrl);
	if (explicitPrUrl) {
		return {
			prUrl: explicitPrUrl,
			source: "explicit" as const,
		};
	}

	const contextUrlPr = extractPullRequestUrl(input.contextUrl);
	if (contextUrlPr) {
		return {
			prUrl: contextUrlPr,
			source: "context_url" as const,
		};
	}

	const contextTextPr = extractPullRequestUrl(input.contextText);
	if (contextTextPr) {
		return {
			prUrl: contextTextPr,
			source: "context_text" as const,
		};
	}

	return {
		prUrl: undefined,
		source: undefined,
	};
}

function inferModeFromRequest(request: AgentAssignmentRequest): AssignmentMode {
	if (
		request.selectedTagId ||
		request.slots.some(
			(slot) =>
				slot.strategy === "tag_random_selected" ||
				slot.strategy === "tag_random_other",
		)
	) {
		return "tag";
	}
	return "regular";
}

function selectNextReviewer<
	T extends {
		_id: string;
		assignmentCount: number;
		createdAt: number;
		effectiveIsAbsent: boolean;
		excludedFromReviewPool?: boolean;
		includedInTagRotations?: boolean;
		tags: string[];
	},
>(reviewers: T[], tagId?: string) {
	const candidates = reviewers
		.filter((reviewer) => isEligibleForAssignment(reviewer, tagId))
		.sort((a, b) => {
			if (a.assignmentCount !== b.assignmentCount) {
				return a.assignmentCount - b.assignmentCount;
			}
			return a.createdAt - b.createdAt;
		});
	return candidates[0] ?? null;
}

function buildFailureMessage(reason: AssignmentFailureReason) {
	switch (reason) {
		case "invalid_strategy":
			return "One of the requested slot strategies is invalid for the current assignment mode.";
		case "missing_reviewer":
			return "A specific-reviewer slot is missing its reviewerId.";
		case "reviewer_not_found":
			return "A requested reviewer could not be found on the selected team.";
		case "reviewer_absent":
			return "A specifically requested reviewer is currently unavailable.";
		case "duplicate_reviewer":
			return "The same reviewer was selected for more than one slot.";
		case "missing_tag":
			return "A tag-based slot is missing the tag it needs to resolve.";
		case "no_candidates":
			return "No valid reviewer candidates were available for one of the requested slots.";
	}
}

export async function authenticateAgentRequest(request: Request) {
	const authorization = request.headers.get("authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return {
			error: jsonError(401, "missing_bearer_token", "Missing Bearer token."),
		};
	}

	const rawToken = authorization.slice("Bearer ".length).trim();
	if (!rawToken) {
		return {
			error: jsonError(401, "invalid_bearer_token", "Invalid Bearer token."),
		};
	}

	const tokenHash = await hashAgentToken(rawToken);
	const auth = await fetchQuery(api.agent.authenticateAgentToken, {
		tokenHash,
	});

	if (!auth) {
		return {
			error: jsonError(
				401,
				"invalid_agent_token",
				"Invalid or revoked agent token.",
			),
		};
	}

	return {
		auth: {
			...auth,
			tokenHash,
		},
	};
}

export function resolveAgentTeam(
	auth: AuthenticatedAgent,
	explicitTeamSlug?: string,
	options?: { requireSelection?: boolean },
): TeamResolution {
	const accessibleTeams = auth.teams;
	const defaultTeam = auth.defaultAgentTeamSlug
		? accessibleTeams.find((team) => team.slug === auth.defaultAgentTeamSlug)
		: undefined;
	const explicitTeam = explicitTeamSlug
		? accessibleTeams.find((team) => team.slug === explicitTeamSlug)
		: undefined;

	if (explicitTeamSlug && !explicitTeam) {
		return {
			error: jsonError(
				403,
				"forbidden_team",
				"The requested team is not available for this personal agent token.",
			),
		};
	}

	const selectedTeam =
		explicitTeam ||
		defaultTeam ||
		(accessibleTeams.length === 1 ? accessibleTeams[0] : null);
	const warnings: AgentWarning[] = [];

	if (!selectedTeam && options?.requireSelection) {
		warnings.push({
			code: "ambiguous_team",
			message:
				"Multiple teams are available and no default team could be resolved. Provide teamSlug explicitly.",
		});
	}

	return {
		error: null,
		selectedTeam,
		defaultTeamSlug: defaultTeam?.slug,
		warnings,
	};
}

// Reviewers of the other teams a cross-team request points at, tagged with the
// team each one belongs to. Unknown slugs are reported instead of throwing so a
// single bad slug cannot block the whole assignment.
async function fetchCrossTeamReviewers(additionalTeamSlugs: string[]): Promise<{
	reviewersByTeamSlug: Array<{
		teamSlug: string;
		reviewers: Awaited<ReturnType<typeof fetchReviewersForTeam>>;
	}>;
	unknownTeamSlugs: string[];
}> {
	const results = await Promise.all(
		additionalTeamSlugs.map(async (teamSlug) => {
			try {
				return { teamSlug, reviewers: await fetchReviewersForTeam(teamSlug) };
			} catch (_error) {
				return { teamSlug, reviewers: null };
			}
		}),
	);

	return {
		reviewersByTeamSlug: results.filter(
			(
				entry,
			): entry is {
				teamSlug: string;
				reviewers: NonNullable<typeof entry.reviewers>;
			} => entry.reviewers !== null,
		),
		unknownTeamSlugs: results
			.filter((entry) => entry.reviewers === null)
			.map((entry) => entry.teamSlug),
	};
}

function fetchReviewersForTeam(teamSlug: string) {
	return fetchQuery(api.queries.getReviewers, { teamSlug });
}

async function fetchSelectedTeamData(selectedTeamSlug: string, prUrl?: string) {
	const [reviewers, tags, assignmentFeed, duplicate] = await Promise.all([
		fetchQuery(api.queries.getReviewers, { teamSlug: selectedTeamSlug }),
		fetchQuery(api.queries.getTags, { teamSlug: selectedTeamSlug }),
		fetchQuery(api.queries.getAssignmentFeed, { teamSlug: selectedTeamSlug }),
		prUrl
			? fetchQuery(api.queries.checkPRAlreadyAssigned, {
					teamSlug: selectedTeamSlug,
					prUrl,
				})
			: Promise.resolve(null),
	]);

	return {
		reviewers,
		tags,
		assignmentFeed,
		duplicate,
	};
}

export async function buildAgentContextResponse(
	auth: AuthenticatedAgent,
	query: { teamSlug?: string; prUrl?: string },
): Promise<
	AgentResult<{
		actorEmail?: string;
		accessibleTeams: AgentTeamSummary[];
		defaultTeamSlug?: string;
		selectedTeam: AgentTeamSummary | null;
		crossTeamTargets: AgentTeamSummary[];
		reviewers: AgentReviewerSummary[];
		tags: AgentTagSummary[];
		nextReviewerHints: {
			regular: AgentReviewerSummary | null;
			byTag: Array<{
				tagId: string;
				tagName: string;
				reviewer: AgentReviewerSummary | null;
			}>;
		};
		recentAssignments: AgentRecentAssignmentSummary[];
		duplicate: AgentDuplicateSummary | null;
		warnings: AgentWarning[];
	}>
> {
	const teamResolution = resolveAgentTeam(auth, query.teamSlug);
	if (teamResolution.error) {
		return { error: teamResolution.error };
	}

	if (!teamResolution.selectedTeam) {
		return {
			body: {
				actorEmail: auth.email,
				accessibleTeams: auth.teams.map(summarizeTeam),
				defaultTeamSlug: teamResolution.defaultTeamSlug,
				selectedTeam: null,
				crossTeamTargets: [],
				reviewers: [],
				tags: [],
				nextReviewerHints: {
					regular: null,
					byTag: [],
				},
				recentAssignments: [],
				duplicate: null,
				warnings: teamResolution.warnings,
			},
			tokenId: auth.tokenId,
		};
	}

	const selectedTeamSlug = teamResolution.selectedTeam.slug;
	const [{ reviewers, tags, assignmentFeed, duplicate }, allTeams] =
		await Promise.all([
			fetchSelectedTeamData(selectedTeamSlug, query.prUrl),
			fetchQuery(api.queries.getTeams, {}),
		]);
	const crossTeamTargets = allTeams
		.filter((team) => team.slug !== selectedTeamSlug)
		.map((team) =>
			summarizeTeam({
				id: team._id,
				name: team.name,
				slug: team.slug,
			}),
		);
	const summarizedTags = tags.map((tag) =>
		summarizeTag({
			_id: String(tag._id),
			name: tag.name,
			color: tag.color,
		}),
	);
	const normalizedReviewers = reviewers.map((reviewer) => ({
		...reviewer,
		_id: String(reviewer._id),
		tags: reviewer.tags.map((tagId) => String(tagId)),
	}));
	const regularHint = selectNextReviewer(normalizedReviewers);

	return {
		body: {
			actorEmail: auth.email,
			accessibleTeams: auth.teams.map(summarizeTeam),
			defaultTeamSlug: teamResolution.defaultTeamSlug,
			selectedTeam: summarizeTeam(teamResolution.selectedTeam),
			crossTeamTargets,
			reviewers: normalizedReviewers.map(summarizeReviewer),
			tags: summarizedTags,
			nextReviewerHints: {
				regular: regularHint ? summarizeReviewer(regularHint) : null,
				byTag: summarizedTags.map((tag) => {
					const tagHint = selectNextReviewer(normalizedReviewers, tag.id);
					return {
						tagId: tag.id,
						tagName: tag.name,
						reviewer: tagHint ? summarizeReviewer(tagHint) : null,
					};
				}),
			},
			recentAssignments: summarizeRecentAssignments(assignmentFeed.items),
			duplicate: duplicate
				? {
						reviewerName: duplicate.reviewerName,
						timestamp: duplicate.timestamp,
					}
				: null,
			warnings: teamResolution.warnings,
		},
		tokenId: auth.tokenId,
	};
}

export async function previewAgentAssignment(
	auth: AuthenticatedAgent,
	input: AgentAssignmentRequest,
): Promise<
	AgentResult<{
		normalizedRequest: {
			teamSlug?: string;
			additionalTeamSlugs: string[];
			crossTeamReview: boolean;
			excludeTeammates: boolean;
			selectedTagId?: string;
			prUrl?: string;
			contextUrl?: string;
			contextText?: string;
			urgent: boolean;
			forceDuplicate: boolean;
			notify: boolean;
			slots: Array<{
				strategy: AssignmentSlotInput["strategy"];
				reviewerId?: Id<"reviewers">;
				tagId?: Id<"tags">;
			}>;
		};
		mode: AssignmentMode;
		resolved: Array<{
			slotIndex: number;
			reviewer: Record<string, unknown> & { _id: Id<"reviewers"> };
			teamSlug?: string;
			tagId?: string;
		}>;
		failed: Array<{ slotIndex: number; reason: AssignmentFailureReason }>;
		duplicate: unknown;
		tags: unknown[];
		warnings: AgentWarning[];
		canExecute: boolean;
		actionByReviewerId?: Id<"reviewers">;
		selectedTeam?: AuthenticatedAgent["teams"][number];
	}>
> {
	const teamResolution = resolveAgentTeam(auth, input.teamSlug, {
		requireSelection: true,
	});
	if (teamResolution.error) {
		return { error: teamResolution.error };
	}

	const crossTeamReview = input.crossTeamReview === true;
	const requestedAdditionalTeamSlugs = crossTeamReview
		? resolveBroadcastTeamSlugs({
				sourceTeamSlug: teamResolution.selectedTeam?.slug,
				reviewerTeamSlugs: input.additionalTeamSlugs ?? [],
			})
		: [];
	const excludeTeammates =
		crossTeamReview &&
		input.excludeTeammates === true &&
		requestedAdditionalTeamSlugs.length > 0;

	const normalizedInput = {
		teamSlug: teamResolution.selectedTeam?.slug,
		additionalTeamSlugs: requestedAdditionalTeamSlugs,
		crossTeamReview,
		excludeTeammates,
		selectedTagId: normalizeOptionalText(input.selectedTagId),
		prUrl: undefined as string | undefined,
		contextUrl: normalizeOptionalText(input.contextUrl),
		contextText: normalizeOptionalText(input.contextText),
		urgent: input.urgent === true,
		forceDuplicate: input.forceDuplicate === true,
		notify: resolveAgentNotifyFlag(input.notify),
		slots: input.slots.map((slot) => ({
			strategy: slot.strategy,
			reviewerId: normalizeOptionalText(slot.reviewerId) as
				| Id<"reviewers">
				| undefined,
			tagId: normalizeOptionalText(slot.tagId) as Id<"tags"> | undefined,
		})),
	};
	const resolvedPrUrl = resolveRequestedPrUrl({
		prUrl: input.prUrl,
		contextUrl: normalizedInput.contextUrl,
		contextText: normalizedInput.contextText,
	});
	normalizedInput.prUrl = resolvedPrUrl.prUrl;

	if (!teamResolution.selectedTeam) {
		return {
			body: {
				normalizedRequest: normalizedInput,
				mode: inferModeFromRequest(input),
				resolved: [],
				failed: [],
				tags: [],
				warnings: teamResolution.warnings,
				duplicate: null,
				canExecute: false,
			},
			tokenId: auth.tokenId,
		};
	}

	const { reviewers, tags, duplicate } = await fetchSelectedTeamData(
		teamResolution.selectedTeam.slug,
		normalizedInput.prUrl,
	);
	const { reviewersByTeamSlug, unknownTeamSlugs } =
		requestedAdditionalTeamSlugs.length > 0
			? await fetchCrossTeamReviewers(requestedAdditionalTeamSlugs)
			: { reviewersByTeamSlug: [], unknownTeamSlugs: [] };
	const { reviewers: reviewerPool, teamSlugByReviewerId } =
		buildCrossTeamReviewerPool({
			sourceTeamSlug: teamResolution.selectedTeam.slug,
			sourceReviewers: reviewers,
			additionalTeams: reviewersByTeamSlug,
			excludeTeammates,
		});
	// The assigner is always looked up in their own team, even when their
	// teammates are excluded from the reviewer pool.
	const actorReviewer = auth.email
		? reviewers.find(
				(reviewer) =>
					reviewer.email.toLowerCase() === auth.email?.toLowerCase(),
			)
		: undefined;
	const mode = inferModeFromRequest(input);
	const resolution = resolveAssignmentSlots({
		mode,
		selectedTagId: normalizedInput.selectedTagId as Id<"tags"> | undefined,
		slots: normalizedInput.slots as AssignmentSlotInput<
			Id<"reviewers">,
			Id<"tags">
		>[],
		reviewers: reviewerPool,
		excludedReviewerId: actorReviewer?._id,
	});

	const warnings = [
		...teamResolution.warnings,
		...(crossTeamReview && requestedAdditionalTeamSlugs.length === 0
			? [
					{
						code: "cross_team_without_targets",
						message:
							"crossTeamReview was requested without any other team in additionalTeamSlugs, so only the requesting team's reviewers were considered.",
					},
				]
			: []),
		...unknownTeamSlugs.map((slug) => ({
			code: "unknown_team",
			message: `Team "${slug}" was not found and was excluded from the cross-team reviewer pool.`,
		})),
		...resolution.failed.map((failure) => ({
			code: failure.reason,
			message: buildFailureMessage(failure.reason),
			slotIndex: failure.slotIndex,
		})),
	];

	if (resolvedPrUrl.source === "context_url") {
		warnings.push({
			code: "inferred_pr_url",
			message:
				"Using a PR URL inferred from contextUrl because prUrl was not provided explicitly.",
		});
	}

	if (resolvedPrUrl.source === "context_text") {
		warnings.push({
			code: "inferred_pr_url",
			message:
				"Using a PR URL inferred from conversation context because prUrl was not provided explicitly.",
		});
	}

	if (duplicate && !normalizedInput.forceDuplicate) {
		warnings.push({
			code: "duplicate_pr",
			message:
				"This PR already appears in the assignment feed. Confirm forceDuplicate before executing.",
		});
	}

	return {
		body: {
			normalizedRequest: normalizedInput,
			mode,
			resolved: resolution.resolved.map((item) => ({
				slotIndex: item.slotIndex,
				reviewer: item.reviewer,
				teamSlug: teamSlugByReviewerId.get(String(item.reviewer._id)),
				tagId: item.tagId ? String(item.tagId) : undefined,
			})),
			failed: resolution.failed,
			duplicate,
			tags,
			warnings,
			canExecute:
				Boolean(teamResolution.selectedTeam) &&
				resolution.resolved.length > 0 &&
				(!duplicate || normalizedInput.forceDuplicate),
			actionByReviewerId: actorReviewer?._id,
			selectedTeam: teamResolution.selectedTeam,
		},
		tokenId: auth.tokenId,
	};
}

export async function executeAgentAssignment(
	auth: AuthenticatedAgent,
	input: AgentAssignmentRequest,
): Promise<
	| {
			error: Response;
	  }
	| {
			body: {
				normalizedRequest: unknown;
				selectedTeam: AuthenticatedAgent["teams"][number];
				assigned: Array<{
					slotIndex: number;
					reviewer: {
						id: string;
						name: string;
						email: string;
						assignmentCount: number;
						isAbsent: boolean;
						effectiveIsAbsent: boolean;
						createdAt: number;
						tags: string[];
						teamSlug?: string;
					};
					tagId?: string;
				}>;
				warnings: AgentWarning[];
				duplicate: unknown;
				batchId?: string;
				forced: boolean;
				source: "agent";
				notificationQueued: boolean;
				notifiedTeamSlugs: string[];
			};
	  }
> {
	const preview = await previewAgentAssignment(auth, input);
	if ("error" in preview) return preview;

	const { body, tokenId } = preview;
	if (!body.canExecute || !body.selectedTeam?.slug) {
		const status =
			body.duplicate && !body.normalizedRequest.forceDuplicate ? 409 : 400;
		return {
			error: jsonError(
				status,
				"assignment_blocked",
				"Assignment could not be executed from the current preview state.",
			),
		};
	}

	const { normalizedRequest } = body;
	let assignedReviewers: Array<{
		slotIndex: number;
		reviewer: {
			id: string;
			name: string;
			email: string;
			assignmentCount: number;
			isAbsent: boolean;
			effectiveIsAbsent: boolean;
			createdAt: number;
			tags: string[];
			teamSlug?: string;
		};
		tagId?: string;
	}> = [];
	let batchId: string | undefined;
	let forced = false;

	if (body.resolved.length === 1 && !normalizedRequest.crossTeamReview) {
		const [resolved] = body.resolved;
		const [slot] = normalizedRequest.slots;
		forced = slot?.strategy === "specific";
		const result = await fetchMutation(api.mutations.assignPR, {
			agentTokenHash: auth.tokenHash,
			reviewerId: resolved.reviewer._id,
			forced,
			urgent: normalizedRequest.urgent,
			source: "agent",
			prUrl: normalizedRequest.prUrl,
			contextUrl: normalizedRequest.contextUrl,
			tagId: resolved.tagId as Id<"tags"> | undefined,
			actionByReviewerId: body.actionByReviewerId,
		});

		assignedReviewers = [
			{
				slotIndex: resolved.slotIndex,
				reviewer: {
					id: String(result.reviewer.id),
					name: result.reviewer.name,
					email: result.reviewer.email,
					assignmentCount: result.reviewer.assignmentCount,
					isAbsent: result.reviewer.isAbsent,
					effectiveIsAbsent: result.reviewer.effectiveIsAbsent,
					createdAt: result.reviewer.createdAt,
					tags: result.reviewer.tags.map((tagId) => String(tagId)),
					teamSlug: resolved.teamSlug ?? body.selectedTeam.slug,
				},
				tagId: resolved.tagId,
			},
		];

		if (body.actionByReviewerId) {
			try {
				await fetchMutation(api.mutations.createActivePRAssignment, {
					teamSlug: body.selectedTeam.slug,
					assigneeId: resolved.reviewer._id,
					assignerId: body.actionByReviewerId,
					prUrl: normalizedRequest.prUrl,
					urgent: normalizedRequest.urgent,
				});
			} catch (error) {
				console.warn(
					"Failed to create active assignment for agent flow:",
					error,
				);
			}
		}
	} else {
		const batchResult = await fetchMutation(api.mutations.assignPRBatch, {
			agentTokenHash: auth.tokenHash,
			teamSlug: body.selectedTeam.slug,
			additionalTeamSlugs: normalizedRequest.additionalTeamSlugs,
			crossTeamReview: normalizedRequest.crossTeamReview,
			excludeTeammates: normalizedRequest.excludeTeammates,
			mode: body.mode,
			selectedTagId: normalizedRequest.selectedTagId as Id<"tags"> | undefined,
			slots: normalizedRequest.slots.map((slot) => ({
				strategy: slot.strategy,
				reviewerId: slot.reviewerId,
				tagId: slot.tagId,
			})),
			prUrl: normalizedRequest.prUrl,
			contextUrl: normalizedRequest.contextUrl,
			urgent: normalizedRequest.urgent,
			actionByReviewerId: body.actionByReviewerId,
			source: "agent",
		});

		batchId = batchResult.batchId;
		assignedReviewers = batchResult.assigned.map((item) => ({
			slotIndex: item.slotIndex,
			reviewer: {
				id: String(item.reviewer.id),
				name: item.reviewer.name,
				email: item.reviewer.email,
				assignmentCount: item.reviewer.assignmentCount,
				isAbsent: item.reviewer.isAbsent,
				effectiveIsAbsent: item.reviewer.effectiveIsAbsent,
				createdAt: item.reviewer.createdAt,
				tags: item.reviewer.tags.map((tagId) => String(tagId)),
				teamSlug: item.reviewer.teamSlug,
			},
			tagId: item.tagId,
		}));
	}

	const notificationQueued = shouldQueueAgentAssignmentChat({
		source: "agent",
		prUrl: normalizedRequest.prUrl,
		assignedCount: assignedReviewers.length,
	});
	// The requesting team's channel always gets the message; every team a
	// reviewer was assigned from gets it too.
	const notifiedTeamSlugs = notificationQueued
		? resolveNotifiedTeamSlugs({
				sourceTeamSlug: body.selectedTeam.slug,
				reviewerTeamSlugs: assignedReviewers.map(
					(item) => item.reviewer.teamSlug,
				),
			})
		: [];
	const warnings = [...body.warnings];
	if (!normalizedRequest.prUrl?.trim()) {
		warnings.push({
			code: "notification_skipped_missing_pr_url",
			message:
				"Google Chat was not queued because the assignment is missing a PR URL.",
		});
	}

	await fetchMutation(api.agent.markAgentTokenUsed, { tokenId });

	return {
		body: {
			normalizedRequest,
			selectedTeam: body.selectedTeam,
			assigned: assignedReviewers,
			warnings,
			duplicate: body.duplicate,
			batchId,
			forced,
			source: "agent" as const,
			notificationQueued,
			notifiedTeamSlugs,
		},
	};
}

export { jsonError };
