import assert from "node:assert/strict";
import test from "node:test";
import {
	buildClaudeMcpInstallCommand,
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
	const command = buildClaudeMcpInstallCommand(
		"https://la-lista.vercel.app",
		"ll_live_example",
	);
	assert.equal(
		command,
		'claude mcp add --transport http la-lista https://la-lista.vercel.app/api/mcp --header "Authorization: Bearer ll_live_example"',
	);
});
