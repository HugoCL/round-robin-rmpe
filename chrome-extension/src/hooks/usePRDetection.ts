import { useCallback, useEffect, useState } from "react";
import type { PRData } from "../types";

/**
 * Hook to get PR data from the current active tab via the content script.
 */
export function usePRDetection() {
	const [prData, setPrData] = useState<PRData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const detectPR = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			// Get the active tab
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab?.id || !tab.url) {
				setPrData(null);
				setLoading(false);
				return;
			}

			// Check if URL matches a GitHub PR pattern
			const prMatch = tab.url.match(
				/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/,
			);

			if (!prMatch) {
				setPrData(null);
				setLoading(false);
				return;
			}

			// Try to get data from content script
			try {
				const response = await chrome.tabs.sendMessage(tab.id, {
					type: "GET_PR_DATA",
				});

				if (response?.success && response.data) {
					setPrData(response.data);
				} else {
					// Fallback: construct basic PR data from URL
					setPrData({
						url: `https://github.com/${prMatch[1]}/pull/${prMatch[2]}`,
						title:
							tab.title
								?.split(" · ")[0]
								?.replace(/^.+? by .+$/, tab.title.split(" by ")[0]) || "",
						author: "",
						repoFullName: prMatch[1],
						prNumber: prMatch[2],
					});
				}
			} catch {
				// Content script might not be injected yet — fallback
				setPrData({
					url: `https://github.com/${prMatch[1]}/pull/${prMatch[2]}`,
					title: tab.title?.split(" · ")[0] || "",
					author: "",
					repoFullName: prMatch[1],
					prNumber: prMatch[2],
				});
			}
		} catch (err) {
			setError("Could not detect PR data");
			setPrData(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		detectPR();
	}, [detectPR]);

	return { prData, loading, error, refresh: detectPR };
}
