import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import {
	getAgeDays,
	getStalenessLevel,
	isStale,
	STALE_DAYS_THRESHOLD,
} from "@/components/feature-flags/featureFlagAge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
	type AgentResult,
	type AuthenticatedAgent,
	jsonError,
	resolveAgentTeam,
} from "@/lib/agent-api";

const featureFlagStatusFilterSchema = z
	.enum(["active", "removed", "all"])
	.optional()
	.describe("Filter by lifecycle status. Defaults to active.");

const featureFlagSortSchema = z
	.enum(["oldest", "newest", "key"])
	.optional()
	.describe("Sort order. Defaults to oldest (best for cleanup).");

const teamSlugSchema = z
	.string()
	.trim()
	.min(1)
	.optional()
	.describe("Team slug. Defaults to the token owner's default team when set.");

export const agentListFeatureFlagsSchema = z.object({
	teamSlug: teamSlugSchema,
	status: featureFlagStatusFilterSchema,
	sort: featureFlagSortSchema,
	limit: z
		.number()
		.int()
		.min(1)
		.max(200)
		.optional()
		.describe("Maximum flags to return per status bucket."),
});

export const agentRegisterFeatureFlagSchema = z.object({
	teamSlug: teamSlugSchema,
	key: z
		.string()
		.trim()
		.min(1)
		.describe("Feature flag key as used in code (e.g. enable_new_checkout)."),
	description: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe("Optional rollout context or removal criteria."),
});

export const agentRemoveFeatureFlagSchema = z.object({
	featureFlagId: z
		.string()
		.trim()
		.min(1)
		.describe("Convex document id of the feature flag to mark removed."),
});

function summarizeFlag(flag: {
	_id: Id<"featureFlags">;
	key: string;
	description?: string;
	status: "active" | "removed";
	createdAt: number;
	removedAt?: number;
	createdBy: {
		authorName: string;
		authorEmail?: string;
	};
}) {
	const ageDays = getAgeDays(flag.createdAt);
	const staleness = getStalenessLevel(ageDays);

	return {
		id: String(flag._id),
		key: flag.key,
		description: flag.description,
		status: flag.status,
		createdAt: flag.createdAt,
		removedAt: flag.removedAt,
		ageDays,
		staleness,
		isStale: flag.status === "active" && isStale(ageDays),
		createdBy: {
			name: flag.createdBy.authorName,
			email: flag.createdBy.authorEmail,
		},
	};
}

export async function listAgentFeatureFlags(
	auth: AuthenticatedAgent,
	input: z.infer<typeof agentListFeatureFlagsSchema>,
): Promise<AgentResult<Record<string, unknown>>> {
	const teamResolution = resolveAgentTeam(auth, input.teamSlug, {
		requireSelection: true,
	});
	if (teamResolution.error) {
		return { error: teamResolution.error };
	}
	if (!teamResolution.selectedTeam) {
		return {
			error: jsonError(
				400,
				"ambiguous_team",
				"Multiple teams are available. Provide teamSlug explicitly.",
			),
		};
	}

	const result = await fetchQuery(api.featureFlags.listFeatureFlagsForAgent, {
		agentTokenHash: auth.tokenHash,
		teamSlug: teamResolution.selectedTeam.slug,
		status: input.status,
		sort: input.sort,
		limit: input.limit,
	});

	const staleActiveCount = result.flags.filter(
		(flag) => flag.status === "active" && isStale(getAgeDays(flag.createdAt)),
	).length;

	return {
		tokenId: auth.tokenId,
		body: {
			selectedTeam: {
				id: String(teamResolution.selectedTeam.id),
				name: teamResolution.selectedTeam.name,
				slug: teamResolution.selectedTeam.slug,
			},
			defaultTeamSlug: teamResolution.defaultTeamSlug,
			summary: {
				...result.summary,
				staleActiveCount,
				staleThresholdDays: STALE_DAYS_THRESHOLD,
			},
			flags: result.flags.map(summarizeFlag),
		},
	};
}

export async function registerAgentFeatureFlag(
	auth: AuthenticatedAgent,
	input: z.infer<typeof agentRegisterFeatureFlagSchema>,
): Promise<AgentResult<Record<string, unknown>>> {
	const teamResolution = resolveAgentTeam(auth, input.teamSlug, {
		requireSelection: true,
	});
	if (teamResolution.error) {
		return { error: teamResolution.error };
	}
	if (!teamResolution.selectedTeam) {
		return {
			error: jsonError(
				400,
				"ambiguous_team",
				"Multiple teams are available. Provide teamSlug explicitly.",
			),
		};
	}

	try {
		const result = await fetchMutation(
			api.featureFlags.createFeatureFlagForAgent,
			{
				agentTokenHash: auth.tokenHash,
				teamSlug: teamResolution.selectedTeam.slug,
				key: input.key,
				description: input.description,
			},
		);

		return {
			tokenId: auth.tokenId,
			body: {
				selectedTeam: {
					id: String(teamResolution.selectedTeam.id),
					name: teamResolution.selectedTeam.name,
					slug: teamResolution.selectedTeam.slug,
				},
				featureFlagId: String(result.featureFlagId),
				key: result.key,
			},
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Failed to register feature flag.";
		return {
			error: jsonError(400, "register_feature_flag_failed", message),
		};
	}
}

export async function removeAgentFeatureFlag(
	auth: AuthenticatedAgent,
	input: z.infer<typeof agentRemoveFeatureFlagSchema>,
): Promise<AgentResult<Record<string, unknown>>> {
	try {
		const result = await fetchMutation(
			api.featureFlags.removeFeatureFlagForAgent,
			{
				agentTokenHash: auth.tokenHash,
				featureFlagId: input.featureFlagId as Id<"featureFlags">,
			},
		);

		return {
			tokenId: auth.tokenId,
			body: {
				featureFlagId: String(result.featureFlagId),
				key: result.key,
				status: "removed",
			},
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to remove feature flag.";
		const status = message.includes("not found") ? 404 : 400;
		return {
			error: jsonError(status, "remove_feature_flag_failed", message),
		};
	}
}
