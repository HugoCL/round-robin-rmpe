export type ParsedPrUrl = {
	/** `owner/repo`, or the closest thing the host exposes. */
	repo: string;
	/** Pull request / merge request number. */
	number: string;
};

const PR_PATH = /^\/(.+?)\/(?:pull|pulls|merge_requests|pull-requests)\/(\d+)/i;

/**
 * Recognizes the pull request links teams actually paste: GitHub, GitLab and
 * Bitbucket, with or without a trailing `/files`, query string or fragment.
 *
 * Returns `null` when the value is not a pull request link, so callers can tell
 * "not a PR yet" apart from "no input at all".
 */
export function parsePrUrl(value: string): ParsedPrUrl | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	const match = url.pathname.match(PR_PATH);
	if (!match) return null;

	const repo = match[1].replace(/\/-$/, "").replace(/^\/+|\/+$/g, "");
	if (!repo) return null;

	return { repo, number: match[2] };
}

export function isPrUrl(value: string): boolean {
	return parsePrUrl(value) !== null;
}
