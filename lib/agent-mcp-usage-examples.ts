export const MCP_USAGE_EXAMPLE_IDS = [
	"ghAssign",
	"ghUrgent",
	"nextUp",
	"featureFlag",
	"backendTag",
] as const;

export type McpUsageExampleId = (typeof MCP_USAGE_EXAMPLE_IDS)[number];

export const MCP_USAGE_ROTATE_MS = 5500;
export const MCP_USAGE_TUTORIAL_ROTATE_MS = 2800;
