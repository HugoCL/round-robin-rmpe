import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hashAgentToken } from "@/lib/agent-token";
import {
	type AssignmentFailureReason,
	type AssignmentMode,
	type AssignmentSlotInput,
	resolveAssignmentSlots,
} from "@/lib/assignmentResolver";

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

type AuthenticatedAgent = {
	tokenId: Id<"agentTokens">;
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

type AgentResult<T> =
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
		tags: string[];
	},
>(reviewers: T[], tagId?: string) {
	const candidates = reviewers
		.filter((reviewer) => !reviewer.effectiveIsAbsent)
		.filter((reviewer) => (tagId ? reviewer.tags.includes(tagId) : true))
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

	return { auth };
}

function resolveSelectedTeam(
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
		accessibleTeams: AuthenticatedAgent["teams"];
		defaultTeamSlug?: string;
		selectedTeam: AuthenticatedAgent["teams"][number] | null;
		reviewers: unknown[];
		tags: unknown[];
		nextReviewerHints: {
			regular: unknown;
			byTag: Array<{ tagId: string; tagName: string; reviewer: unknown }>;
		};
		recentAssignments: unknown[];
		duplicate: unknown;
		warnings: AgentWarning[];
	}>
> {
	const teamResolution = resolveSelectedTeam(auth, query.teamSlug);
	if (teamResolution.error) {
		return { error: teamResolution.error };
	}

	if (!teamResolution.selectedTeam) {
		return {
			body: {
				actorEmail: auth.email,
				accessibleTeams: auth.teams,
				defaultTeamSlug: teamResolution.defaultTeamSlug,
				selectedTeam: null,
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
	const { reviewers, tags, assignmentFeed, duplicate } =
		await fetchSelectedTeamData(selectedTeamSlug, query.prUrl);

	return {
		body: {
			actorEmail: auth.email,
			accessibleTeams: auth.teams,
			defaultTeamSlug: teamResolution.defaultTeamSlug,
			selectedTeam: teamResolution.selectedTeam,
			reviewers,
			tags,
			nextReviewerHints: {
				regular: selectNextReviewer(
					reviewers.map((reviewer) => ({
						...reviewer,
						_id: String(reviewer._id),
						tags: reviewer.tags.map((tagId) => String(tagId)),
					})),
				),
				byTag: tags.map((tag) => ({
					tagId: String(tag._id),
					tagName: tag.name,
					reviewer: selectNextReviewer(
						reviewers.map((reviewer) => ({
							...reviewer,
							_id: String(reviewer._id),
							tags: reviewer.tags.map((tagId) => String(tagId)),
						})),
						String(tag._id),
					),
				})),
			},
			recentAssignments: assignmentFeed.items,
			duplicate,
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
	const teamResolution = resolveSelectedTeam(auth, input.teamSlug, {
		requireSelection: true,
	});
	if (teamResolution.error) {
		return { error: teamResolution.error };
	}

	const normalizedInput = {
		teamSlug: teamResolution.selectedTeam?.slug,
		selectedTagId: normalizeOptionalText(input.selectedTagId),
		prUrl: undefined as string | undefined,
		contextUrl: normalizeOptionalText(input.contextUrl),
		contextText: normalizeOptionalText(input.contextText),
		urgent: input.urgent === true,
		forceDuplicate: input.forceDuplicate === true,
		notify: input.notify === true,
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
		reviewers,
		excludedReviewerId: actorReviewer?._id,
	});

	const warnings = [
		...teamResolution.warnings,
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
					};
					tagId?: string;
				}>;
				warnings: AgentWarning[];
				duplicate: unknown;
				batchId?: string;
				forced: boolean;
				source: "agent";
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
		};
		tagId?: string;
	}> = [];
	let batchId: string | undefined;
	let forced = false;

	if (body.resolved.length === 1) {
		const [resolved] = body.resolved;
		const [slot] = normalizedRequest.slots;
		forced = slot?.strategy === "specific";
		const result = await fetchMutation(api.mutations.assignPR, {
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
			teamSlug: body.selectedTeam.slug,
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
			},
			tagId: item.tagId,
		}));
	}

	if (normalizedRequest.notify && normalizedRequest.prUrl) {
		try {
			const notifyPayload = assignedReviewers.map((item) => ({
				name: item.reviewer.name,
				email: item.reviewer.email,
				reviewerChatId:
					typeof body.resolved.find(
						(resolved) => resolved.slotIndex === item.slotIndex,
					)?.reviewer.googleChatUserId === "string"
						? (body.resolved.find(
								(resolved) => resolved.slotIndex === item.slotIndex,
							)?.reviewer.googleChatUserId as string)
						: undefined,
			}));

			if (notifyPayload.length > 1) {
				await fetchAction(api.actions.sendGoogleChatGroupMessage, {
					reviewers: notifyPayload,
					prUrl: normalizedRequest.prUrl,
					contextUrl: normalizedRequest.contextUrl,
					locale: "es",
					assignerEmail: auth.email || undefined,
					assignerName: auth.email || undefined,
					teamSlug: body.selectedTeam.slug,
					urgent: normalizedRequest.urgent,
				});
			} else if (notifyPayload[0]) {
				await fetchAction(api.actions.sendGoogleChatMessage, {
					reviewerName: notifyPayload[0].name,
					reviewerEmail: notifyPayload[0].email,
					reviewerChatId: notifyPayload[0].reviewerChatId,
					prUrl: normalizedRequest.prUrl,
					contextUrl: normalizedRequest.contextUrl,
					locale: "es",
					assignerEmail: auth.email || undefined,
					assignerName: auth.email || undefined,
					teamSlug: body.selectedTeam.slug,
					urgent: normalizedRequest.urgent,
				});
			}
		} catch (error) {
			console.warn("Agent assignment notification failed:", error);
		}
	}

	await fetchMutation(api.agent.markAgentTokenUsed, { tokenId });

	return {
		body: {
			normalizedRequest,
			selectedTeam: body.selectedTeam,
			assigned: assignedReviewers,
			warnings: body.warnings,
			duplicate: body.duplicate,
			batchId,
			forced,
			source: "agent" as const,
		},
	};
}

export { jsonError };
