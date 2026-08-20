export const DEFAULT_MCP_ORIGIN = "https://la-lista.vercel.app";
export const MCP_TOKEN_PLACEHOLDER = "paste-your-personal-token-here";

export function buildMcpUrl(origin: string): string {
	const trimmed = origin.trim().replace(/\/+$/, "");
	return `${trimmed}/api/mcp`;
}

export function buildClaudeMcpInstallCommand(
	origin: string,
	token: string,
): string {
	const mcpUrl = buildMcpUrl(origin);
	return `claude mcp add --transport http la-lista ${mcpUrl} --header "Authorization: Bearer ${token}"`;
}
