import { fetchMutation } from "convex/nextjs";
import type { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
	agentAssignmentRequestSchema,
	authenticateAgentRequest,
	jsonError,
	previewAgentAssignment,
} from "@/lib/agent-api";

export async function POST(request: NextRequest) {
	const authentication = await authenticateAgentRequest(request);
	if ("error" in authentication) {
		return authentication.error;
	}

	try {
		const payload = agentAssignmentRequestSchema.parse(await request.json());
		const preview = await previewAgentAssignment(authentication.auth, payload);
		if ("error" in preview) {
			return preview.error;
		}

		await fetchMutation(api.agent.markAgentTokenUsed, {
			tokenId: preview.tokenId,
		});

		const {
			actionByReviewerId: _actionByReviewerId,
			selectedTeam,
			...publicBody
		} = preview.body;
		return Response.json({
			...publicBody,
			selectedTeam,
		});
	} catch (error) {
		console.error("Failed to preview agent assignment:", error);
		return jsonError(
			400,
			"invalid_agent_assignment_request",
			"Invalid agent assignment request payload.",
		);
	}
}
