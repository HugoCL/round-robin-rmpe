export const AGENT_ASSIGNMENT_CHAT_LOCALE = "es";

export function shouldQueueAgentAssignmentChat(args: {
	source?: string;
	prUrl?: string;
	assignedCount: number;
}): boolean {
	return (
		args.source === "agent" &&
		Boolean(args.prUrl?.trim()) &&
		args.assignedCount > 0
	);
}

export function resolveAgentNotifyFlag(_notify?: boolean): boolean {
	return true;
}
