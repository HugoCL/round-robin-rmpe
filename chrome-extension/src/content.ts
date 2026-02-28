// Content script — runs on GitHub PR pages (github.com/*/pull/*)
// Extracts PR metadata, responds to popup requests, and injects the
// "Revisión Flash" button for one-click round-robin assignment.

interface PRData {
	url: string;
	title: string;
	author: string;
	repoFullName: string;
	prNumber: string;
}

// ── PR data extraction ──

function extractPRData(): PRData | null {
	const url = window.location.href;

	// Match github.com/:owner/:repo/pull/:number patterns
	const match = url.match(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
	if (!match) return null;

	const repoFullName = match[1];
	const prNumber = match[2];

	// Clean URL — remove any extra paths (e.g. /files, /commits)
	const cleanUrl = `https://github.com/${repoFullName}/pull/${prNumber}`;

	// Extract PR title from the page
	let title = "";
	const titleEl =
		document.querySelector<HTMLElement>(".gh-header-title .js-issue-title") ??
		document.querySelector<HTMLElement>('[data-testid="issue-title"] bdi') ??
		document.querySelector<HTMLElement>(".js-issue-title");

	if (titleEl) {
		title = titleEl.textContent?.trim() ?? "";
	} else {
		// Fallback: extract from <title> tag  "PR title by author · Pull Request #123 · owner/repo"
		const pageTitle = document.title;
		const titleMatch = pageTitle.match(/^(.+?)\s+by\s+/);
		if (titleMatch) {
			title = titleMatch[1].trim();
		}
	}

	// Extract author
	let author = "";
	const authorEl =
		document.querySelector<HTMLAnchorElement>(".gh-header-meta .author a") ??
		document.querySelector<HTMLAnchorElement>('[data-testid="author-login"]') ??
		document.querySelector<HTMLAnchorElement>(".pull-header-author .author");

	if (authorEl) {
		author = authorEl.textContent?.trim() ?? "";
	} else {
		// Fallback from <title> tag
		const pageTitle = document.title;
		const authorMatch = pageTitle.match(/by\s+(\S+)\s+·/);
		if (authorMatch) {
			author = authorMatch[1];
		}
	}

	return {
		url: cleanUrl,
		title,
		author,
		repoFullName,
		prNumber,
	};
}

// ── Message listener for popup ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "GET_PR_DATA") {
		const data = extractPRData();
		sendResponse({ success: true, data });
	}
	return true; // keep channel open for async response
});

// ── Notify background that we're on a PR page ──

const prData = extractPRData();
if (prData) {
	chrome.runtime.sendMessage({
		type: "PR_PAGE_DETECTED",
		data: prData,
	});
}

// ══════════════════════════════════════════════════════════════
// ── Flash Review Button ──
// ══════════════════════════════════════════════════════════════

const BUTTON_ID = "la-lista-flash-review-btn";
const CONTAINER_ID = "la-lista-flash-review-container";
const STYLE_ID = "la-lista-flash-review-styles";

type FlashState = "idle" | "loading" | "success" | "error" | "confirm";

let currentState: FlashState = "idle";
let stateMessage = "";
let stateTimeout: ReturnType<typeof setTimeout> | null = null;

// ── Inject styles ──

function injectStyles() {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
    #${CONTAINER_ID} {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: 8px;
    }

    #${BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 600;
      line-height: 20px;
      white-space: nowrap;
      cursor: pointer;
      border: 1px solid;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      transition: background-color 0.15s ease, border-color 0.15s ease;
      vertical-align: middle;
    }

    /* Idle state — purple accent to stand out */
    #${BUTTON_ID}.flash-idle {
      color: #fff;
      background-color: #8250df;
      border-color: rgba(240,246,252,0.1);
    }
    #${BUTTON_ID}.flash-idle:hover {
      background-color: #6e40c9;
    }

    /* Loading state */
    #${BUTTON_ID}.flash-loading {
      color: #8b949e;
      background-color: transparent;
      border-color: #30363d;
      cursor: wait;
      pointer-events: none;
    }

    /* Success state */
    #${BUTTON_ID}.flash-success {
      color: #fff;
      background-color: #238636;
      border-color: #238636;
      cursor: default;
      pointer-events: none;
    }

    /* Error state */
    #${BUTTON_ID}.flash-error {
      color: #fff;
      background-color: #da3633;
      border-color: #da3633;
      cursor: pointer;
    }

    /* Confirm (already assigned) state — warning yellow */
    #${BUTTON_ID}.flash-confirm {
      color: #000;
      background-color: #d29922;
      border-color: #d29922;
      cursor: pointer;
    }

    /* Spinner animation */
    .la-lista-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #484f58;
      border-top-color: #8b949e;
      border-radius: 50%;
      animation: la-lista-spin 0.6s linear infinite;
    }

    @keyframes la-lista-spin {
      to { transform: rotate(360deg); }
    }

    /* ── Light mode overrides ── */
    [data-color-mode="light"] #${BUTTON_ID}.flash-idle,
    html:not([data-color-mode="dark"]) #${BUTTON_ID}.flash-idle {
      border-color: rgba(31,35,40,0.15);
    }
    [data-color-mode="light"] #${BUTTON_ID}.flash-loading,
    html:not([data-color-mode="dark"]) #${BUTTON_ID}.flash-loading {
      color: #656d76;
      border-color: #d0d7de;
    }
    [data-color-mode="light"] .la-lista-spinner,
    html:not([data-color-mode="dark"]) .la-lista-spinner {
      border-color: #d0d7de;
      border-top-color: #656d76;
    }
  `;
	document.head.appendChild(style);
}

// ── SVG Icons ──

const ICONS = {
	lightning: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.585 0l.63.63L6.982 7h4.2a.5.5 0 0 1 .369.838l-5.96 6.525L4.96 16l3.233-6.363H3.818a.5.5 0 0 1-.369-.838L9.585 0z"/></svg>`,
	check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`,
	alert: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575zM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0z"/></svg>`,
	spinner: `<span class="la-lista-spinner"></span>`,
};

// ── Button rendering ──

function getButtonHTML(state: FlashState, message: string): string {
	switch (state) {
		case "idle":
			return `${ICONS.lightning} Revisión Flash`;
		case "loading":
			return `${ICONS.spinner} Asignando...`;
		case "success":
			return `${ICONS.check} ${message}`;
		case "error":
			return `${ICONS.alert} ${message}`;
		case "confirm":
			return `${ICONS.alert} ${message}`;
	}
}

function getButtonClass(state: FlashState): string {
	return `flash-${state}`;
}

function updateButton() {
	const btn = document.getElementById(BUTTON_ID);
	if (!btn) return;

	btn.innerHTML = getButtonHTML(currentState, stateMessage);
	btn.className = getButtonClass(currentState);

	// Update title attribute for tooltip
	switch (currentState) {
		case "idle":
			btn.title =
				"Asignar el siguiente revisor por round-robin y enviar mensaje a Google Chat";
			break;
		case "error":
			if (stateMessage.includes("extensión")) {
				btn.title = "Haz clic en el ícono de La Lista para iniciar sesión";
			} else {
				btn.title = "Haz clic para reintentar";
			}
			break;
		case "confirm":
			btn.title = "Haz clic para asignar de todos modos";
			break;
		default:
			btn.title = "";
	}
}

function setState(state: FlashState, message = "", autoResetMs?: number) {
	if (stateTimeout) {
		clearTimeout(stateTimeout);
		stateTimeout = null;
	}

	currentState = state;
	stateMessage = message;
	updateButton();

	if (autoResetMs) {
		stateTimeout = setTimeout(() => {
			currentState = "idle";
			stateMessage = "";
			updateButton();
		}, autoResetMs);
	}
}

// ── Flash assign logic ──

async function doFlashAssign(force = false) {
	const pr = extractPRData();
	if (!pr) {
		setState("error", "PR no detectado", 4000);
		return;
	}

	setState("loading");

	try {
		const response = await chrome.runtime.sendMessage({
			type: "FLASH_ASSIGN",
			data: { prUrl: pr.url, force },
		});

		if (!response) {
			setState("error", "Sin respuesta", 4000);
			return;
		}

		if (response.success) {
			setState("success", `Asignado a ${response.reviewerName}`, 4000);
			return;
		}

		// Handle specific error codes
		if (response.error === "NO_TEAM") {
			setState("error", "Selecciona equipo en extensión", 5000);
			return;
		}

		if (response.error === "NO_AUTH") {
			setState("error", "Abre la extensión para iniciar sesión", 5000);
			return;
		}

		if (response.alreadyAssigned) {
			const ago = getTimeAgo(response.existingTimestamp);
			setState(
				"confirm",
				`Ya asignado a ${response.existingReviewerName} (${ago}). ¿Asignar otro?`,
			);
			return;
		}

		// Generic error
		setState("error", response.error || "Error desconocido", 5000);
	} catch (err) {
		setState(
			"error",
			err instanceof Error ? err.message : "Error de conexión",
			5000,
		);
	}
}

function getTimeAgo(timestamp?: number): string {
	if (!timestamp) return "";
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "hace un momento";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `hace ${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `hace ${hours}h`;
	const days = Math.floor(hours / 24);
	return `hace ${days}d`;
}

// ── Button click handler ──

function onButtonClick() {
	switch (currentState) {
		case "idle":
			doFlashAssign(false);
			break;
		case "confirm":
			// User confirmed — force assign
			doFlashAssign(true);
			break;
		case "error":
			// Retry
			setState("idle");
			doFlashAssign(false);
			break;
		// loading, success — ignore clicks
	}
}

// ── Inject button into the page ──

function findInjectionTarget(): {
	parent: Element;
	mode: "prepend" | "append" | "after";
} | null {
	// Strategy 1 (current GitHub): data-component="PH_Actions" — the PageHeader
	// actions container that holds Edit / Code buttons. Most reliable because
	// it's a semantic data attribute rather than a generated class name.
	const phActions = document.querySelector('[data-component="PH_Actions"]');
	if (phActions) return { parent: phActions, mode: "prepend" };

	// Strategy 2 (current GitHub): class prefix match for the actions container
	const prcActions = document.querySelector(
		'[class*="prc-PageHeader-Actions"]',
	);
	if (prcActions) return { parent: prcActions, mode: "prepend" };

	// Strategy 3 (legacy GitHub): .gh-header-actions
	const headerActions = document.querySelector(".gh-header-actions");
	if (headerActions) return { parent: headerActions, mode: "prepend" };

	// Strategy 4: find the Edit button directly and use its grandparent
	// (the d-flex gap-1 wrapper → PH_Actions)
	const editBtn =
		document.querySelector<HTMLElement>("button.js-title-edit-button") ??
		document.querySelector<HTMLElement>('[data-hotkey="e"]');
	if (editBtn?.closest('[data-component="PH_Actions"]')) {
		return {
			parent: editBtn.closest('[data-component="PH_Actions"]')!,
			mode: "prepend",
		};
	}
	if (editBtn?.parentElement?.parentElement) {
		return { parent: editBtn.parentElement.parentElement, mode: "prepend" };
	}

	// Strategy 5 (legacy): .gh-header-show
	const headerShow = document.querySelector(".gh-header-show");
	if (headerShow) return { parent: headerShow, mode: "append" };

	// Strategy 6: PR title via data-testid
	const titleEl = document.querySelector('[data-testid="issue-title"]');
	if (titleEl?.closest(".gh-header")) {
		return { parent: titleEl.closest(".gh-header")!, mode: "append" };
	}

	// Strategy 7: PageHeader description row as last resort
	const pageHeaderDesc = document.querySelector(
		'[class*="prc-PageHeader-Description"]',
	);
	if (pageHeaderDesc?.parentElement) {
		return { parent: pageHeaderDesc.parentElement, mode: "prepend" };
	}

	return null;
}

function injectButton() {
	// Don't inject if already present
	if (document.getElementById(CONTAINER_ID)) return;

	// Only inject on PR pages
	if (!extractPRData()) return;

	injectStyles();

	const target = findInjectionTarget();
	if (!target) {
		console.warn(
			"[La Lista] Could not find injection target for flash review button",
		);
		return;
	}

	const container = createButtonContainer();
	switch (target.mode) {
		case "prepend":
			target.parent.prepend(container);
			break;
		case "append":
			target.parent.appendChild(container);
			break;
		case "after":
			target.parent.after(container);
			break;
	}
}

function createButtonContainer(): HTMLElement {
	const container = document.createElement("div");
	container.id = CONTAINER_ID;

	const btn = document.createElement("button");
	btn.id = BUTTON_ID;
	btn.type = "button";
	btn.addEventListener("click", onButtonClick);

	// Set initial state directly on the element (it's not in the DOM yet,
	// so document.getElementById won't find it — we must use the reference)
	currentState = "idle";
	stateMessage = "";
	btn.innerHTML = getButtonHTML("idle", "");
	btn.className = getButtonClass("idle");
	btn.title =
		"Asignar el siguiente revisor por round-robin y enviar mensaje a Google Chat";

	container.appendChild(btn);

	return container;
}

// ── Handle GitHub SPA navigation ──
// GitHub uses Turbo (formerly pjax) for navigation. The content script
// only runs once on initial page load, so we need to observe DOM changes
// to re-inject the button when navigating between PRs.

function observeNavigation() {
	// Listen for turbo:load events (GitHub's SPA navigation)
	document.addEventListener("turbo:load", () => {
		// Small delay to let the DOM settle
		setTimeout(() => {
			removeExistingButton();
			injectButton();

			// Re-notify background about PR page
			const data = extractPRData();
			if (data) {
				chrome.runtime.sendMessage({
					type: "PR_PAGE_DETECTED",
					data,
				});
			}
		}, 300);
	});

	// Also observe for major DOM changes (fallback for non-turbo navigation)
	const observer = new MutationObserver(() => {
		// Only re-inject if on a PR page and button is missing
		if (extractPRData() && !document.getElementById(CONTAINER_ID)) {
			injectButton();
		}
	});

	// Observe the main content area for changes
	const main =
		document.querySelector("#js-repo-pjax-container") ||
		document.querySelector("[data-turbo-body]") ||
		document.body;

	observer.observe(main, { childList: true, subtree: true });
}

function removeExistingButton() {
	document.getElementById(CONTAINER_ID)?.remove();
}

// ── Initialize ──

// Inject button on initial load. We retry a few times because GitHub
// renders PR pages progressively and the header may not exist yet.
function initFlashReview() {
	let attempts = 0;
	const maxAttempts = 10;
	const interval = 500; // ms between retries

	function tryInject() {
		attempts++;
		injectButton();

		if (!document.getElementById(CONTAINER_ID) && attempts < maxAttempts) {
			setTimeout(tryInject, interval);
		}
	}

	// First attempt after a short delay
	setTimeout(tryInject, 300);
	observeNavigation();
}

initFlashReview();
