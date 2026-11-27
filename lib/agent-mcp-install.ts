export const DEFAULT_MCP_ORIGIN = "https://la-lista.vercel.app";
export const MCP_TOKEN_PLACEHOLDER = "paste-your-personal-token-here";

export const MCP_CLIENTS = ["claude-code", "codex", "other"] as const;
export type McpClient = (typeof MCP_CLIENTS)[number];

export function buildMcpUrl(origin: string): string {
	const trimmed = origin.trim().replace(/\/+$/, "");
	return `${trimmed}/api/mcp`;
}

const snippetBuilders: Record<
	McpClient,
	(mcpUrl: string, token: string) => string
> = {
	"claude-code": (mcpUrl, token) =>
		`claude mcp add --transport http la-lista ${mcpUrl} --header "Authorization: Bearer ${token}"`,
	codex: (mcpUrl, token) =>
		[
			"[mcp_servers.la-lista]",
			`url = "${mcpUrl}"`,
			`http_headers = { Authorization = "Bearer ${token}" }`,
		].join("\n"),
	other: (mcpUrl, token) =>
		[`URL: ${mcpUrl}`, `Authorization: Bearer ${token}`].join("\n"),
};

export function buildMcpInstallSnippet(
	client: McpClient,
	origin: string,
	token: string,
): string {
	return snippetBuilders[client](buildMcpUrl(origin), token);
}
