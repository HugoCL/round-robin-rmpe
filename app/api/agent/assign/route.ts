import type { NextRequest } from "next/server";
import {
	agentAssignmentRequestSchema,
	authenticateAgentRequest,
	executeAgentAssignment,
	jsonError,
} from "@/lib/agent-api";

export async function POST(request: NextRequest) {
	const authentication = await authenticateAgentRequest(request);
	if ("error" in authentication) {
		return authentication.error;
	}

	try {
		const payload = agentAssignmentRequestSchema.parse(await request.json());
		const result = await executeAgentAssignment(authentication.auth, payload);
		if ("error" in result) {
			return result.error;
		}
		return Response.json(result.body);
	} catch (error) {
		console.error("Failed to execute agent assignment:", error);
		return jsonError(
			400,
			"agent_assignment_failed",
			"Failed to execute the requested assignment.",
		);
	}
}
