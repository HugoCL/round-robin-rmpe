type AgentSkillRenderOptions = {
	baseUrl: string;
	defaultTeamSlug?: string;
	tokenPlaceholder?: string;
};

const DEFAULT_TOKEN_PLACEHOLDER = "paste-your-personal-token-here";

const REQUIRED_ENV_VARS = [
	"LA_LISTA_BASE_URL",
	"LA_LISTA_AGENT_TOKEN",
	"LA_LISTA_DEFAULT_TEAM",
] as const;

const PROMPTING_RULES = [
	"Ask only for missing high-signal inputs.",
	"When critical assignment inputs are missing, prefer a structured question UI over freeform back-and-forth.",
	"Use LA_LISTA_DEFAULT_TEAM unless the user explicitly overrides the team.",
	"Before asking for a PR URL, inspect recent conversation context for a GitHub PR link and reuse it when one is already present.",
	"Fetch agent context before choosing reviewers.",
	"Run preview-assignment before assign.",
	"Ask for confirmation before executing if the PR looks like a duplicate and forceDuplicate was not explicitly requested.",
	"Refuse silent execution when the team is ambiguous or no valid reviewer slots can be resolved.",
] as const;

const SAFETY_RULES = [
	"Never execute without a Bearer token in LA_LISTA_AGENT_TOKEN.",
	"Do not persist freeform context text; only send it in preview or assign requests when it helps reasoning.",
	"Treat notifications as opt-in. Default notify=false unless the user asks for messaging.",
	"For single specific-reviewer requests, treat the action as a forced assignment.",
] as const;

function normalizeBaseUrl(baseUrl: string) {
	return baseUrl.replace(/\/+$/, "");
}

function buildClaudeSubagentUrl({
	baseUrl,
	defaultTeamSlug,
}: AgentSkillRenderOptions) {
	const base = `${normalizeBaseUrl(baseUrl)}/api/settings/agent/claude-subagent`;
	if (!defaultTeamSlug) return base;

	return `${base}?defaultTeamSlug=${encodeURIComponent(defaultTeamSlug)}`;
}

export function renderShellEnvSnippet({
	baseUrl,
	defaultTeamSlug,
	tokenPlaceholder = DEFAULT_TOKEN_PLACEHOLDER,
}: AgentSkillRenderOptions) {
	return [
		`export LA_LISTA_BASE_URL="${normalizeBaseUrl(baseUrl)}"`,
		`export LA_LISTA_AGENT_TOKEN="${tokenPlaceholder}"`,
		`export LA_LISTA_DEFAULT_TEAM="${defaultTeamSlug || "your-team-slug"}"`,
	].join("\n");
}

export function renderClaudeSettingsJsonSnippet({
	baseUrl,
	defaultTeamSlug,
	tokenPlaceholder = DEFAULT_TOKEN_PLACEHOLDER,
}: AgentSkillRenderOptions) {
	return JSON.stringify(
		{
			env: {
				LA_LISTA_BASE_URL: normalizeBaseUrl(baseUrl),
				LA_LISTA_AGENT_TOKEN: tokenPlaceholder,
				LA_LISTA_DEFAULT_TEAM: defaultTeamSlug || "your-team-slug",
			},
		},
		null,
		2,
	);
}

export function renderClaudeInstallCommand({
	baseUrl,
	defaultTeamSlug,
}: AgentSkillRenderOptions) {
	const subagentUrl = buildClaudeSubagentUrl({ baseUrl, defaultTeamSlug });

	return [
		"mkdir -p ~/.claude/agents",
		`curl -fsSL "${subagentUrl}" -o ~/.claude/agents/la-lista-assign-pr.md`,
		'printf \'%s\\n\' "Installed ~/.claude/agents/la-lista-assign-pr.md" "Next: set LA_LISTA_BASE_URL, LA_LISTA_AGENT_TOKEN, and LA_LISTA_DEFAULT_TEAM in your shell or Claude Code settings.json."',
	].join(" && \\\n");
}

function renderApiContract(baseUrl: string) {
	return [
		"## API",
		"",
		`Base URL: \`${normalizeBaseUrl(baseUrl)}\``,
		"",
		"`GET /api/agent/context?teamSlug=&prUrl=`",
		"- Bearer token required",
		"- Returns actor email, accessible teams, selected/default team, reviewers, tags, next-reviewer hints, recent assignments, and duplicate info for the PR when provided",
		"",
		"`POST /api/agent/preview-assignment`",
		"- Bearer token required",
		"- JSON body fields: `teamSlug?`, `selectedTagId?`, `prUrl?`, `contextUrl?`, `contextText?`, `urgent?`, `forceDuplicate?`, `notify?`, `slots`",
		"- When `prUrl` is omitted, the server will try to infer it from `contextUrl` or `contextText` if either contains a GitHub PR link",
		"- `slots` entries support `random`, `specific`, `tag_random_selected`, and `tag_random_other`",
		"- `tag_random_selected` requires top-level `selectedTagId`",
		"",
		"`POST /api/agent/assign`",
		"- Same request shape as preview",
		"- Executes the assignment using the same resolution rules",
	].join("\n");
}

export function renderClaudeSubagentMarkdown({
	baseUrl,
	defaultTeamSlug,
}: AgentSkillRenderOptions) {
	const shellSnippet = renderShellEnvSnippet({
		baseUrl,
		defaultTeamSlug,
	});

	return `---
name: la-lista-assign-pr
description: Use when the user wants to assign a GitHub PR in La Lista, especially after creating a PR with /ship or when they mention reviewers, urgency, force, tags, notifications, or assigning a PR from conversation context.
tools: Bash
---

# La Lista PR Assignment Agent

Use this agent when the user wants to assign a GitHub pull request to one or more reviewers in La Lista, especially after a previous PR creation step like \`/ship\` or when they mention urgency, forced assignment, tags, notifications, or reviewer selection.

## Setup

- This file belongs in \`~/.claude/agents/\`, not the project's \`.claude/agents/\`.
- Required environment variables:
  - \`${REQUIRED_ENV_VARS[0]}\`
  - \`${REQUIRED_ENV_VARS[1]}\`
  - \`${REQUIRED_ENV_VARS[2]}\`

\`\`\`bash
${shellSnippet}
\`\`\`

## Workflow

1. Read the user request and identify the intended team, PR URL, urgency, and whether they want one or multiple reviewers.
2. If the user did not provide a PR URL explicitly, inspect recent conversation context for a GitHub PR link, especially after a previous PR creation step such as \`/ship\`.
3. Call \`/api/agent/context\` first. Use \`${REQUIRED_ENV_VARS[2]}\` unless the user clearly overrides the team.
4. Resolve the slot plan:
   - Regular next reviewer: \`random\`
   - Specific reviewer: \`specific\`
   - Tag-based slot using a chosen tag: \`tag_random_selected\` plus top-level \`selectedTagId\`
   - Tag-based slot using a different tag per slot: \`tag_random_other\` plus slot \`tagId\`
5. Call \`/api/agent/preview-assignment\`.
6. If preview says the PR is already assigned and the user did not explicitly request forcing the duplicate, ask for confirmation before continuing.
7. Only call \`/api/agent/assign\` after preview succeeds and the intent is clear.
8. Summarize the assigned reviewers and any warnings after execution.

## Clarifications

- If \`AskUserQuestion\` is available and the assignment is missing critical inputs, use it to collect them through Claude's built-in UI instead of asking in plain text.
- Prefer one compact \`AskUserQuestion\` interaction that gathers the missing assignment inputs together.
- Use \`AskUserQuestion\` for things like:
  - team override when multiple teams are possible
  - reviewer strategy or number of reviewers
  - selected reviewer or tag
  - urgent, notify, or duplicate-force confirmation
- Do not use \`AskUserQuestion\` for information that is already available from defaults, recent conversation context, or API responses.

## Prompting Rules

${PROMPTING_RULES.map((rule) => `- ${rule}`).join("\n")}

## Safety Rules

${SAFETY_RULES.map((rule) => `- ${rule}`).join("\n")}

## Bash Notes

- Use \`curl\` with \`Authorization: Bearer $LA_LISTA_AGENT_TOKEN\`.
- Send JSON bodies with compact, explicit fields.
- Prefer one preview call and one assign call. Do not retry assign automatically on logical errors.

${renderApiContract(baseUrl)}
`;
}

export function renderUniversalAgentSpec({
	baseUrl,
	defaultTeamSlug,
}: AgentSkillRenderOptions) {
	const shellSnippet = renderShellEnvSnippet({
		baseUrl,
		defaultTeamSlug,
	});
	const settingsJson = renderClaudeSettingsJsonSnippet({
		baseUrl,
		defaultTeamSlug,
	});

	return `# La Lista Personal PR Assignment Agent

This specification describes a user-level agent that can assign pull requests in La Lista from a conversation. The agent should be installed in personal tooling, not in project-scoped agent folders.

## Environment

Required environment variables:

${REQUIRED_ENV_VARS.map((name) => `- \`${name}\``).join("\n")}

\`\`\`bash
${shellSnippet}
\`\`\`

Example Claude Code \`settings.json\` environment block:

\`\`\`json
${settingsJson}
\`\`\`

## Required Behavior

${PROMPTING_RULES.map((rule) => `- ${rule}`).join("\n")}

## Safety

${SAFETY_RULES.map((rule) => `- ${rule}`).join("\n")}

${renderApiContract(baseUrl)}

## Notes

- Default team should come from \`${REQUIRED_ENV_VARS[2]}\` unless the user overrides it.
- Freeform \`contextText\` is for reasoning only and should not be treated as persisted assignment metadata.
- If \`prUrl\` is omitted, preview and assign will infer it from \`contextUrl\` or \`contextText\` when those fields contain a GitHub PR link.
- If the host environment provides a structured question tool or UI, use it to collect missing assignment inputs instead of relying on multiple plain-text follow-ups.
- The agent should explain any duplicate, missing-tag, missing-reviewer, or no-candidate warnings before execution.
`;
}
