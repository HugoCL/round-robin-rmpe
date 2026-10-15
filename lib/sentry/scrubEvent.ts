import type { Event } from "@sentry/nextjs";

const EMAIL_PLACEHOLDER = "[email]";
const CIRCULAR_PLACEHOLDER = "[Circular]";

// `%40` covers addresses that arrive URL-encoded in query strings.
const EMAIL_PATTERN =
	/[A-Za-z0-9._+-]+(?:@|%40)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gi;

const DENIED_HEADERS = new Set([
	"authorization",
	"cookie",
	"proxy-authorization",
	"set-cookie",
	"x-forwarded-for",
	"x-real-ip",
]);
const DENIED_HEADER_PREFIX = "x-clerk-";

function isPlainObject(value: object): value is Record<string, unknown> {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function redactEmails(value: unknown, ancestors: WeakSet<object>): unknown {
	if (typeof value === "string") {
		return value.replace(EMAIL_PATTERN, EMAIL_PLACEHOLDER);
	}
	if (typeof value !== "object" || value === null) return value;
	const isArray = Array.isArray(value);
	if (!isArray && !isPlainObject(value)) return value;
	if (ancestors.has(value)) return CIRCULAR_PLACEHOLDER;

	ancestors.add(value);
	try {
		if (isArray) return value.map((item) => redactEmails(item, ancestors));
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				redactEmails(item, ancestors),
			]),
		);
	} finally {
		ancestors.delete(value);
	}
}

function dropSensitiveRequestParts(request: NonNullable<Event["request"]>) {
	const { cookies: _cookies, data: _data, headers, ...rest } = request;
	if (!headers) return rest;
	const safeHeaders = Object.fromEntries(
		Object.entries(headers).filter(([name]) => {
			const lower = name.toLowerCase();
			return (
				!DENIED_HEADERS.has(lower) && !lower.startsWith(DENIED_HEADER_PREFIX)
			);
		}),
	);
	return { ...rest, headers: safeHeaders };
}

export function scrubEvent<T extends Event>(event: T): T {
	try {
		const { user: _user, request, ...rest } = event;
		const stripped = request
			? { ...rest, request: dropSensitiveRequestParts(request) }
			: rest;
		return redactEmails(stripped, new WeakSet()) as T;
	} catch {
		const { user: _user, request: _request, ...rest } = event;
		return rest as T;
	}
}
