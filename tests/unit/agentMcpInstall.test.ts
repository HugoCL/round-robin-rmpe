import assert from "node:assert/strict";
import test from "node:test";
import {
	buildMcpInstallSnippet,
	buildMcpUrl,
} from "../../lib/agent-mcp-install";

test("builds the remote MCP URL without a trailing slash", () => {
	assert.equal(
		buildMcpUrl("https://la-lista.vercel.app/"),
		"https://la-lista.vercel.app/api/mcp",
	);
	assert.equal(
		buildMcpUrl("https://la-lista.vercel.app"),
		"https://la-lista.vercel.app/api/mcp",
	);
});

test("builds the Claude Code one-liner with the bearer token", () => {
	const command = buildMcpInstallSnippet(
		"claude-code",
		"https://la-lista.vercel.app",
		"ll_live_example",
	);
	assert.equal(
		command,
		'claude mcp add --transport http la-lista https://la-lista.vercel.app/api/mcp --header "Authorization: Bearer ll_live_example"',
	);
});

test("builds the Codex config.toml table with the bearer token", () => {
	const config = buildMcpInstallSnippet(
		"codex",
		"https://la-lista.vercel.app/",
		"ll_live_example",
	);
	assert.equal(
		config,
		[
			"[mcp_servers.la-lista]",
			'url = "https://la-lista.vercel.app/api/mcp"',
			'http_headers = { Authorization = "Bearer ll_live_example" }',
		].join("\n"),
	);
});

test("builds the generic URL and header pair for other clients", () => {
	const snippet = buildMcpInstallSnippet(
		"other",
		"https://la-lista.vercel.app",
		"ll_live_example",
	);
	assert.equal(
		snippet,
		"URL: https://la-lista.vercel.app/api/mcp\nAuthorization: Bearer ll_live_example",
	);
});
