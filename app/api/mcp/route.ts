import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { authenticateAgentRequest, jsonError } from "@/lib/agent-api";
import { createLaListaMcpServer } from "@/lib/agent-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
	const authentication = await authenticateAgentRequest(request);
	if ("error" in authentication) {
		return authentication.error;
	}

	const server = createLaListaMcpServer(authentication.auth);
	const transport = new WebStandardStreamableHTTPServerTransport({
		enableJsonResponse: true,
		sessionIdGenerator: undefined,
	});

	try {
		await server.connect(transport);
		return await transport.handleRequest(request);
	} catch (error) {
		console.error("Failed to handle MCP request:", error);
		return jsonError(
			500,
			"mcp_request_failed",
			"Failed to handle MCP request.",
		);
	} finally {
		await server.close();
	}
}

export function GET() {
	return methodNotAllowed();
}

export function DELETE() {
	return methodNotAllowed();
}

export function PUT() {
	return methodNotAllowed();
}

export function PATCH() {
	return methodNotAllowed();
}

function methodNotAllowed() {
	return Response.json(
		{
			error: {
				code: "method_not_allowed",
				message: "Use POST /api/mcp for MCP Streamable HTTP requests.",
			},
		},
		{
			status: 405,
			headers: {
				Allow: "POST",
			},
		},
	);
}
