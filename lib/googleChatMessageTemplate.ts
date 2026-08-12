export const GOOGLE_CHAT_REVIEWER_PLACEHOLDER = "{{reviewer_name}}";
export const GOOGLE_CHAT_REQUESTER_PLACEHOLDER = "{{requester_name}}";

export const REQUIRED_PR_CHAT_PLACEHOLDERS = [
	GOOGLE_CHAT_REVIEWER_PLACEHOLDER,
	GOOGLE_CHAT_REQUESTER_PLACEHOLDER,
] as const;

const LEGACY_PR_LINK_PLACEHOLDER = "<URL_PLACEHOLDER|PR>";

const DEFAULT_TEMPLATE_ES =
	"Hola {{reviewer_name}} 👋\n{{requester_name}} te ha asignado esta revisión";

const DEFAULT_TEMPLATE_EN =
	"Hi {{reviewer_name}} 👋\n{{requester_name}} assigned you this review";

const REPLY_THREAD_KEY = "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD ";

export function getDefaultPRChatMessageTemplate(locale?: string): string {
	return locale?.toLowerCase().startsWith("es")
		? DEFAULT_TEMPLATE_ES
		: DEFAULT_TEMPLATE_EN;
}

export function formatGoogleChatPerson(name: string, chatId?: string): string {
	const trimmedId = chatId?.trim();
	if (trimmedId) {
		return `<users/${trimmedId}>`;
	}
	return name.trim() || name;
}

export function stripPrLinkPlaceholders(message: string): string {
	return message
		.replaceAll(LEGACY_PR_LINK_PLACEHOLDER, "")
		.replace(/\{\{\s*pr\s*\}\}/gi, "")
		.replace(/<https?:\/\/[^>|]+\|PR>/g, "")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/ +\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function parsePrIdentity(prUrl: string): string {
	try {
		const url = new URL(prUrl.trim());
		const host = url.hostname.replace(/^www\./, "");
		const path = url.pathname;

		const github = path.match(/^\/([^/]+)\/([^/]+)\/(?:pull|pulls)\/(\d+)/i);
		if (github?.[1] && github[2] && github[3]) {
			return `${github[1]}/${github[2]} #${github[3]}`;
		}

		const gitlab = path.match(/^\/(.+)\/-\/merge_requests\/(\d+)/i);
		if (gitlab?.[1] && gitlab[2]) {
			return `${gitlab[1]} !${gitlab[2]}`;
		}

		const generic = path.match(
			/\/(?:pull|pulls|merge_requests)\/(\d+)(?:[/?#]|$)/i,
		);
		if (generic?.[1]) {
			return `${host} #${generic[1]}`;
		}

		return host;
	} catch {
		return prUrl.trim();
	}
}

type ChatOpenLinkButton = {
	text: string;
	onClick: {
		openLink: {
			url: string;
		};
	};
};

export function buildPrAssignmentChatMessage(options: {
	text: string;
	prUrl: string;
	contextUrl?: string;
	locale: string;
	urgent?: boolean;
	cardId?: string;
}) {
	const isSpanish = options.locale.toLowerCase().startsWith("es");
	const title = options.urgent
		? isSpanish
			? "Revisión urgente"
			: "Urgent review"
		: isSpanish
			? "Revisión asignada"
			: "Review assigned";

	const buttons: ChatOpenLinkButton[] = [
		{
			text: isSpanish ? "Ver PR" : "View PR",
			onClick: {
				openLink: {
					url: options.prUrl,
				},
			},
		},
	];

	const contextUrl = options.contextUrl?.trim();
	if (contextUrl) {
		buttons.push({
			text: isSpanish ? "Ver Contexto" : "View Context",
			onClick: {
				openLink: {
					url: contextUrl,
				},
			},
		});
	}

	return {
		text: options.text,
		cardsV2: [
			{
				cardId: options.cardId ?? "pr-assignment-card",
				card: {
					header: {
						title,
						subtitle: parsePrIdentity(options.prUrl),
					},
					sections: [
						{
							widgets: [
								{
									buttonList: {
										buttons,
									},
								},
							],
						},
					],
				},
			},
		],
		thread: { threadKey: REPLY_THREAD_KEY },
	};
}
