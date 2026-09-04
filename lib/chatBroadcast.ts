/**
 * Cross-team assignment notifications.
 *
 * When a PR is assigned to reviewers from another team, the Google Chat
 * message has to reach two kinds of channel: the requesting team's channel
 * (the team that sends the PR) and the channel of every team a reviewer was
 * actually assigned from (the teams that receive it). Broadcast targets are
 * therefore derived from the assigned reviewers, never from the candidate
 * pool, so teams that were only considered are not notified.
 */

import { type ChatThreadLink, mergeChatThreadLinks } from "./assignmentHistory";
import {
	buildPrAssignmentChatMessage,
	GOOGLE_CHAT_MESSAGE_REPLY_OPTION,
} from "./googleChatMessageTemplate";

/** Extra team channels to notify besides the requesting team's own channel. */
export function resolveBroadcastTeamSlugs(options: {
	sourceTeamSlug?: string;
	reviewerTeamSlugs: Array<string | undefined | null>;
}): string[] {
	const sourceTeamSlug = options.sourceTeamSlug?.trim();
	return [
		...new Set(
			options.reviewerTeamSlugs
				.map((slug) => slug?.trim())
				.filter(
					(slug): slug is string => Boolean(slug) && slug !== sourceTeamSlug,
				),
		),
	];
}

/** Every team channel the assignment message is expected to land in. */
export function resolveNotifiedTeamSlugs(options: {
	sourceTeamSlug?: string;
	reviewerTeamSlugs: Array<string | undefined | null>;
}): string[] {
	const sourceTeamSlug = options.sourceTeamSlug?.trim();
	return [
		...(sourceTeamSlug ? [sourceTeamSlug] : []),
		...resolveBroadcastTeamSlugs(options),
	];
}

/** Human-readable reason why one or more team channels missed the message. */
export function describeChatDeliveryProblems(
	failures: string[],
	missingWebhookSlugs: string[],
): string | undefined {
	const problems = [
		...missingWebhookSlugs.map(
			(slug) => `${slug}: Google Chat webhook URL not configured`,
		),
		...failures,
	];
	return problems.length > 0 ? problems.join("; ") : undefined;
}

/** Error text for an assignment that reached some channels but not all. */
export function describePartialChatDelivery(
	deliveredSlugs: string[],
	problems: string,
): string {
	return `Sent to ${deliveredSlugs.join(", ")} but failed for ${problems}`;
}

export function prependUrgentNotice(
	message: string,
	locale: string,
	urgent?: boolean,
) {
	if (!urgent) return message;
	const urgentNotice = locale.startsWith("es")
		? "🚨 URGENTE: este PR debe revisarse lo antes posible."
		: "🚨 URGENT: this PR should be reviewed as soon as possible.";
	return `${urgentNotice}\n${message}`;
}

export function prependOriginTeamNotice(
	message: string,
	locale: string,
	sourceTeamName: string,
	isExternalTarget: boolean,
) {
	if (!isExternalTarget) return message;
	const notice = locale.startsWith("es")
		? `🔁 Esta solicitud de revisión viene del equipo ${sourceTeamName}.`
		: `🔁 This review request comes from team ${sourceTeamName}.`;
	return `${notice}\n${message}`;
}

export type ChatWebhookTarget = {
	slug: string;
	name: string;
	webhookUrl: string;
	isExternalTarget: boolean;
};

export type GoogleChatWebhookResponse = {
	thread?: {
		name?: string;
	};
	name?: string;
	messageLink?: string;
};

export function toGoogleChatThreadUrl(
	response: GoogleChatWebhookResponse | null,
): string | undefined {
	const directLink = response?.messageLink?.trim();
	if (directLink?.startsWith("http")) {
		return directLink;
	}

	const threadName = response?.thread?.name?.trim();
	if (threadName) {
		const threadMatch = threadName.match(/^spaces\/([^/]+)\/threads\/([^/]+)$/);
		if (threadMatch) {
			const [, spaceId, threadId] = threadMatch;
			return `https://chat.google.com/room/${encodeURIComponent(spaceId)}/${encodeURIComponent(threadId)}`;
		}
	}

	const messageName = response?.name?.trim();
	if (messageName) {
		const messageMatch = messageName.match(
			/^spaces\/([^/]+)\/messages\/([^/]+)$/,
		);
		if (messageMatch) {
			const [, spaceId, messageId] = messageMatch;
			return `https://chat.google.com/room/${encodeURIComponent(spaceId)}/${encodeURIComponent(messageId)}`;
		}
	}

	return undefined;
}

export function withGoogleChatMessageReplyOption(webhookUrl: string): string {
	try {
		const url = new URL(webhookUrl);
		if (!url.searchParams.has("messageReplyOption")) {
			url.searchParams.set(
				"messageReplyOption",
				GOOGLE_CHAT_MESSAGE_REPLY_OPTION,
			);
		}
		return url.toString();
	} catch {
		return webhookUrl;
	}
}

export type ChatDelivery = {
	deliveredSlugs: string[];
	failures: string[];
	googleChatThreadUrl?: string;
	googleChatThreadUrls: ChatThreadLink[];
};

// Delivers the same assignment message to every resolved team channel.
// One failing webhook must never stop the remaining channels: cross-team
// assignments depend on both the requesting and the receiving team getting it.
export async function deliverChatMessageToTargets(options: {
	targets: ChatWebhookTarget[];
	baseMessage: string;
	sourceTeamName: string;
	locale: string;
	prUrl: string;
	contextUrl?: string;
	urgent: boolean;
	cardId: string;
}): Promise<ChatDelivery> {
	const deliveredSlugs: string[] = [];
	const failures: string[] = [];
	const googleChatThreadUrls: ChatThreadLink[] = [];

	for (const target of options.targets) {
		const targetMessage = prependOriginTeamNotice(
			options.baseMessage,
			options.locale,
			options.sourceTeamName,
			target.isExternalTarget,
		);
		const message = buildPrAssignmentChatMessage({
			text: targetMessage,
			prUrl: options.prUrl,
			contextUrl: options.contextUrl,
			locale: options.locale,
			urgent: options.urgent,
			cardId: options.cardId,
		});

		try {
			const response = await fetch(
				withGoogleChatMessageReplyOption(target.webhookUrl),
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(message),
				},
			);

			if (!response.ok) {
				const text = await response.text().catch(() => "");
				failures.push(
					`${target.slug}: HTTP ${response.status} ${response.statusText}${
						text ? ` ${text}` : ""
					}`.trim(),
				);
				continue;
			}

			deliveredSlugs.push(target.slug);

			const responseBody = (await response
				.clone()
				.json()
				.catch(() => null)) as GoogleChatWebhookResponse | null;
			const threadUrl = toGoogleChatThreadUrl(responseBody);
			if (threadUrl) {
				googleChatThreadUrls.push({
					teamSlug: target.slug,
					teamName: target.name,
					url: threadUrl,
				});
			}
		} catch (error) {
			failures.push(
				`${target.slug}: ${
					error instanceof Error ? error.message : "request failed"
				}`,
			);
		}
	}

	const mergedThreadUrls = mergeChatThreadLinks(
		undefined,
		googleChatThreadUrls,
	);
	return {
		deliveredSlugs,
		failures,
		googleChatThreadUrl: mergedThreadUrls[0]?.url,
		googleChatThreadUrls: mergedThreadUrls,
	};
}
