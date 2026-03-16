import { fetchMutation } from "convex/nextjs";
import type { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
	authenticateAgentRequest,
	buildAgentContextResponse,
	jsonError,
} from "@/lib/agent-api";

export async function GET(request: NextRequest) {
	const authentication = await authenticateAgentRequest(request);
	if ("error" in authentication) {
		return authentication.error;
	}

	const { searchParams } = new URL(request.url);
	const teamSlug = searchParams.get("teamSlug")?.trim() || undefined;
	const prUrl = searchParams.get("prUrl")?.trim() || undefined;

	try {
		const response = await buildAgentContextResponse(authentication.auth, {
			teamSlug,
			prUrl,
		});
		if ("error" in response) {
			return response.error;
		}

		if (response.tokenId) {
			await fetchMutation(api.agent.markAgentTokenUsed, {
				tokenId: response.tokenId,
			});
		}

		return Response.json(response.body);
	} catch (error) {
		console.error("Failed to load agent context:", error);
		return jsonError(
			500,
			"agent_context_failed",
			"Failed to load agent context.",
		);
	}
}
