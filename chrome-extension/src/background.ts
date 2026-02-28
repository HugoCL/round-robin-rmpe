// Background service worker for the La Lista Chrome Extension
// Manages badge state based on whether the current tab is a GitHub PR page
// and handles flash-assign requests from the content script.

const PR_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;
const CONVEX_SITE_URL = "https://admired-weasel-950.convex.site";

// Update badge when tab changes
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
	try {
		const tab = await chrome.tabs.get(tabId);
		updateBadge(tab);
	} catch {
		// Tab might not exist anymore
	}
});

// Update badge when URL changes
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
	if (changeInfo.url || changeInfo.status === "complete") {
		updateBadge(tab);
	}
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "PR_PAGE_DETECTED" && sender.tab?.id) {
		// Set the active badge when content script confirms PR page
		chrome.action.setBadgeText({ text: "PR", tabId: sender.tab.id });
		chrome.action.setBadgeBackgroundColor({
			color: "#22c55e",
			tabId: sender.tab.id,
		});
	}

	if (message.type === "FLASH_ASSIGN") {
		handleFlashAssign(message.data).then(sendResponse);
		return true; // keep channel open for async response
	}
});

function updateBadge(tab: chrome.tabs.Tab) {
	if (!tab.id) return;

	const isOnPR = tab.url ? PR_URL_PATTERN.test(tab.url) : false;

	if (isOnPR) {
		chrome.action.setBadgeText({ text: "PR", tabId: tab.id });
		chrome.action.setBadgeBackgroundColor({
			color: "#22c55e",
			tabId: tab.id,
		});
	} else {
		chrome.action.setBadgeText({ text: "", tabId: tab.id });
	}
}

// ── Flash Assign handler ──

interface FlashAssignRequest {
	prUrl: string;
	force?: boolean;
}

interface FlashAssignResponse {
	success: boolean;
	reviewerName?: string;
	alreadyAssigned?: boolean;
	existingReviewerName?: string;
	existingTimestamp?: number;
	error?: string;
}

async function handleFlashAssign(
	data: FlashAssignRequest,
): Promise<FlashAssignResponse> {
	try {
		// 1. Read stored team slug
		const teamResult = await chrome.storage.local.get("la-lista-selected-team");
		const teamSlug = teamResult["la-lista-selected-team"];
		if (!teamSlug) {
			return {
				success: false,
				error: "NO_TEAM",
			};
		}

		// 2. Read stored auth token
		const tokenResult = await chrome.storage.session.get(
			"la-lista-clerk-token",
		);
		const token = tokenResult["la-lista-clerk-token"];
		if (!token) {
			return {
				success: false,
				error: "NO_AUTH",
			};
		}

		// 3. Call the Convex HTTP endpoint
		const response = await fetch(`${CONVEX_SITE_URL}/flash-assign`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				teamSlug,
				prUrl: data.prUrl,
				force: data.force ?? false,
			}),
		});

		const result: FlashAssignResponse = await response.json();
		return result;
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error de conexión",
		};
	}
}
