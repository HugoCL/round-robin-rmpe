import type { NextRequest } from "next/server";
import { renderUniversalAgentSpec } from "@/lib/agent-skill-spec";

export async function GET(request: NextRequest) {
	const { searchParams, origin } = new URL(request.url);
	const defaultTeamSlug =
		searchParams.get("defaultTeamSlug")?.trim() || undefined;
	const markdown = renderUniversalAgentSpec({
		baseUrl: origin,
		defaultTeamSlug,
	});

	return new Response(markdown, {
		status: 200,
		headers: {
			"content-type": "text/markdown; charset=utf-8",
			"content-disposition": 'attachment; filename="la-lista-agent-spec.md"',
		},
	});
}
