import { useEffect, useState } from "react";

const STORAGE_KEY = "la-lista-send-chat";

/**
 * Persists the Google Chat notification toggle.
 */
export function useChatToggle() {
	const [sendChat, setSendChat] = useState(true);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		chrome.storage.local.get(STORAGE_KEY, (result) => {
			if (typeof result[STORAGE_KEY] === "boolean") {
				setSendChat(result[STORAGE_KEY]);
			}
			setLoaded(true);
		});
	}, []);

	const toggleChat = (value: boolean) => {
		setSendChat(value);
		chrome.storage.local.set({ [STORAGE_KEY]: value });
	};

	return { sendChat, toggleChat, loaded };
}
