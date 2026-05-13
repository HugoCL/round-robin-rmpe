import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fetchMutation } from "convex/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import {
	type AuthenticatedAgent,
	agentAssignmentRequestSchema,
	buildAgentContextResponse,
	executeAgentAssignment,
	previewAgentAssignment,
} from "@/lib/agent-api";

const slotInputSchema = z.object({
	strategy: z
		.enum(["random", "specific", "tag_random_selected", "tag_random_other"])
		.describe("How this reviewer slot should be resolved."),
	reviewerId: z
		.string()
		.optional()
		.describe("Required when strategy is specific."),
	tagId: z
		.string()
		.optional()
		.describe("Required when strategy is tag_random_other."),
});

const assignmentInputSchema = {
	teamSlug: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe(
			"Team slug. Defaults to the token owner's default team when set.",
		),
	selectedTagId: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe("Tag used by tag_random_selected slots."),
	prUrl: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe("Pull request URL to assign."),
	contextUrl: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe(
			"Optional source URL used to infer a PR URL when prUrl is absent.",
		),
	contextText: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe(
			"Optional conversation text used to infer a PR URL when prUrl is absent.",
		),
	urgent: z.boolean().optional().describe("Whether the assignment is urgent."),
	forceDuplicate: z
		.boolean()
		.optional()
		.describe("Required to execute when this PR already appears assigned."),
	notify: z
		.boolean()
		.optional()
		.describe("Whether La Lista should send Google Chat notifications."),
	slots: z
		.array(slotInputSchema)
		.min(1)
		.describe("Reviewer slots to resolve and assign."),
};

const contextInputSchema = {
	teamSlug: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe(
			"Team slug. Defaults to the token owner's default team when set.",
		),
	prUrl: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe("Optional PR URL for duplicate detection."),
};

function toolResult(body: unknown): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(body, null, 2),
			},
		],
		structuredContent: body as Record<string, unknown>,
	};
}

async function errorResult(response: Response): Promise<CallToolResult> {
	const body = await response.json().catch(() => ({
		error: {
			code: "request_failed",
			message: response.statusText || "Request failed.",
		},
	}));

	return {
		isError: true,
		content: [
			{
				type: "text",
				text: JSON.stringify(body, null, 2),
			},
		],
		structuredContent:
			body && typeof body === "object" ? (body as Record<string, unknown>) : {},
	};
}

export function createLaListaMcpServer(auth: AuthenticatedAgent) {
	const server = new McpServer({
		name: "la-lista-pr-assignments",
		version: "1.0.0",
	});

	server.registerTool(
		"la_lista_get_context",
		{
			title: "Get La Lista assignment context",
			description:
				"Load accessible teams, selected/default team, reviewers, tags, next-reviewer hints, recent assignments, and duplicate information.",
			inputSchema: contextInputSchema,
		},
		async (input) => {
			const result = await buildAgentContextResponse(auth, input);
			if ("error" in result) return errorResult(result.error);

			await fetchMutation(api.agent.markAgentTokenUsed, {
				tokenId: result.tokenId,
			});

			return toolResult(result.body);
		},
	);

	server.registerTool(
		"la_lista_preview_assignment",
		{
			title: "Preview La Lista PR assignment",
			description:
				"Resolve reviewer slots and warnings without mutating assignment counts or history.",
			inputSchema: assignmentInputSchema,
		},
		async (input) => {
			const payload = agentAssignmentRequestSchema.parse(input);
			const result = await previewAgentAssignment(auth, payload);
			if ("error" in result) return errorResult(result.error);

			await fetchMutation(api.agent.markAgentTokenUsed, {
				tokenId: result.tokenId,
			});

			const {
				actionByReviewerId: _actionByReviewerId,
				selectedTeam,
				...publicBody
			} = result.body;

			return toolResult({
				...publicBody,
				selectedTeam,
			});
		},
	);

	server.registerTool(
		"la_lista_assign_pr",
		{
			title: "Assign a PR in La Lista",
			description:
				"Execute a La Lista PR assignment after previewing. Duplicate PRs are blocked unless forceDuplicate is true.",
			inputSchema: assignmentInputSchema,
			annotations: {
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: true,
				readOnlyHint: false,
			},
		},
		async (input) => {
			const payload = agentAssignmentRequestSchema.parse(input);
			const result = await executeAgentAssignment(auth, payload);
			if ("error" in result) return errorResult(result.error);

			return toolResult(result.body);
		},
	);

	return server;
}
