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

/** Cross-team review is implied whenever another team slug is actually sent. */
export function resolveAgentCrossTeamFlags(input: {
	sourceTeamSlug?: string;
	crossTeamReview?: boolean;
	additionalTeamSlugs?: string[];
}): {
	crossTeamReview: boolean;
	additionalTeamSlugs: string[];
} {
	const sourceTeamSlug = input.sourceTeamSlug?.trim();
	const additionalTeamSlugs = [
		...new Set(
			(input.additionalTeamSlugs ?? [])
				.map((slug) => slug.trim())
				.filter((slug) => slug.length > 0 && slug !== sourceTeamSlug),
		),
	];
	return {
		crossTeamReview: additionalTeamSlugs.length > 0,
		additionalTeamSlugs,
	};
}
