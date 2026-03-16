export const GOOGLE_CHAT_REVIEWER_PLACEHOLDER = "{{reviewer_name}}";
export const GOOGLE_CHAT_REQUESTER_PLACEHOLDER = "{{requester_name}}";
export const GOOGLE_CHAT_PR_LINK_PLACEHOLDER = "<URL_PLACEHOLDER|PR>";

export const REQUIRED_PR_CHAT_PLACEHOLDERS = [
	GOOGLE_CHAT_REVIEWER_PLACEHOLDER,
	GOOGLE_CHAT_REQUESTER_PLACEHOLDER,
	GOOGLE_CHAT_PR_LINK_PLACEHOLDER,
] as const;

const DEFAULT_TEMPLATE_ES =
	"Hola {{reviewer_name}} 👋\n{{requester_name}} te ha asignado la revisión de este <URL_PLACEHOLDER|PR>";

const DEFAULT_TEMPLATE_EN =
	"Hi {{reviewer_name}} 👋\n{{requester_name}} assigned you to review this <URL_PLACEHOLDER|PR>";

export function getDefaultPRChatMessageTemplate(locale?: string): string {
	return locale?.toLowerCase().startsWith("es")
		? DEFAULT_TEMPLATE_ES
		: DEFAULT_TEMPLATE_EN;
}
