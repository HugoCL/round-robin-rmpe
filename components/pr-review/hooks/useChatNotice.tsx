import { useTranslations } from "next-intl";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";

export type ChatSend = () => Promise<{
	success: boolean;
	partial?: boolean;
	error?: string;
}>;

/** "partial": some channels got it, so it is not retried (they would get it twice). */
export type ChatOutcome = "sent" | "partial" | "failed";

export const CHAT_OUTCOME_MESSAGE_KEYS = {
	sent: "messages.chatNotified",
	partial: "messages.chatPartiallyNotified",
	failed: "messages.chatNotNotified",
} as const satisfies Record<ChatOutcome, string>;

/**
 * Sends a Google Chat notice and reports whether it went out, so the caller
 * can fold the outcome into its single result toast. `retryAction` re-sends
 * the payload captured at assign time; the form is cleared by then.
 */
export function useChatNotice() {
	const t = useTranslations();

	const send = async (chatSend: ChatSend): Promise<ChatOutcome> => {
		try {
			const result = await chatSend();
			if (result.success) return "sent";
			console.error("Failed to send Google Chat message:", result.error);
			return result.partial ? "partial" : "failed";
		} catch (error) {
			console.error("Failed to send Google Chat message:", error);
			return "failed";
		}
	};

	const retry = async (chatSend: ChatSend) => {
		const outcome = await send(chatSend);
		toast(
			outcome === "sent"
				? { description: t("messages.chatNotificationSent") }
				: outcome === "partial"
					? {
							title: t("common.warning"),
							description: t("messages.chatPartiallyNotified"),
						}
					: {
							title: t("common.warning"),
							description: t("messages.chatStillNotNotified"),
							variant: "destructive",
							action: retryAction(chatSend),
							// A retry nobody saw is a notice nobody got; it stays until dismissed.
							duration: Number.POSITIVE_INFINITY,
						},
		);
	};

	const retryAction = (chatSend: ChatSend) => (
		<ToastAction
			altText={t("messages.chatNotificationRetry")}
			onClick={() => void retry(chatSend)}
		>
			{t("messages.chatNotificationRetry")}
		</ToastAction>
	);

	return { send, retryAction };
}
