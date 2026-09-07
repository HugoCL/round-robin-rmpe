/**
 * The safe shape of a team for anyone who is not administering it.
 *
 * `googleChatWebhookUrl` is a credential: anyone holding it can post into the
 * team's Chat space. Several queries used to return the raw team document,
 * including `getTeams`, which is unauthenticated and powers both the landing
 * page and the Chrome extension.
 */

export type TeamLike = {
	_id: string;
	_creationTime: number;
	name: string;
	slug: string;
	createdAt?: number;
	timezone?: string;
	googleChatWebhookUrl?: string;
};

export type PublicTeam<T extends TeamLike> = Omit<T, "googleChatWebhookUrl"> & {
	/** Lets the UI show "configured" without handing over the URL. */
	hasGoogleChatWebhook: boolean;
};

export function toPublicTeam<T extends TeamLike>(team: T): PublicTeam<T> {
	const { googleChatWebhookUrl, ...rest } = team;
	return {
		...rest,
		hasGoogleChatWebhook:
			typeof googleChatWebhookUrl === "string" &&
			googleChatWebhookUrl.trim().length > 0,
	} as PublicTeam<T>;
}

export function toPublicTeams<T extends TeamLike>(
	teams: readonly T[],
): PublicTeam<T>[] {
	return teams.map((team) => toPublicTeam(team));
}
