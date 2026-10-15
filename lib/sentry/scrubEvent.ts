import type { BrowserOptions, Event } from "@sentry/nextjs";

type StreamedSpanJSON = Parameters<
	NonNullable<BrowserOptions["beforeSendSpan"]>
>[0];

const EMAIL_PLACEHOLDER = "[email]";
const CIRCULAR_PLACEHOLDER = "[Circular]";
const TRUNCATED_PLACEHOLDER = "[Truncated]";
const DROPPED_PLACEHOLDER = "[event dropped by privacy scrubber]";
const MAX_DEPTH = 20;

// Bounded quantifiers keep matching linear on long strings. `=`, `&` and `?`
// stay out of the local part so query keys survive (`owner=[email]&page=2`).
// The TLD must be alphabetic so `react@19.1.0` is not mistaken for an address.
const EMAIL_PATTERN =
	/[\w.%+\-'!#$*^`{|}~]{1,64}(?:@|%40)(?:[A-Za-z0-9-]{1,63}(?:\.|%2E)){1,10}[A-Za-z]{2,24}/gi;

const DENIED_HEADERS = new Set([
	"authorization",
	"cookie",
	"proxy-authorization",
	"set-cookie",
	"x-forwarded-for",
	"x-real-ip",
]);
const DENIED_HEADER_PREFIX = "x-clerk-";

const IDENTITY_ATTRIBUTE_PREFIXES = ["user.", "sentry.user."];
const IDENTITY_ATTRIBUTES = new Set([
	"client.address",
	"http.client_ip",
	"net.peer.ip",
	"network.peer.address",
	"vercel.proxy.client_ip",
]);
const REQUEST_HEADER_ATTRIBUTE_PREFIX = "http.request.header.";

function isDeniedHeader(name: string): boolean {
	const lower = name.toLowerCase();
	return DENIED_HEADERS.has(lower) || lower.startsWith(DENIED_HEADER_PREFIX);
}

function isIdentityAttribute(key: string): boolean {
	if (IDENTITY_ATTRIBUTES.has(key)) return true;
	if (IDENTITY_ATTRIBUTE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
		return true;
	}
	return (
		key.startsWith(REQUEST_HEADER_ATTRIBUTE_PREFIX) &&
		isDeniedHeader(key.slice(REQUEST_HEADER_ATTRIBUTE_PREFIX.length))
	);
}

function isPlainObject(value: object): value is Record<string, unknown> {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

// Throws only on structure it cannot enumerate. Every child read is isolated,
// so a hostile property is omitted instead of aborting the whole walk.
function redactValue(
	value: unknown,
	depth: number,
	ancestors: WeakSet<object>,
): unknown {
	if (typeof value === "string") {
		return value.replace(EMAIL_PATTERN, EMAIL_PLACEHOLDER);
	}
	if (typeof value !== "object" || value === null) return value;
	const isArray = Array.isArray(value);
	if (!isArray && !isPlainObject(value)) return value;
	if (ancestors.has(value)) return CIRCULAR_PLACEHOLDER;
	if (depth >= MAX_DEPTH) return TRUNCATED_PLACEHOLDER;

	ancestors.add(value);
	try {
		const source: Record<string, unknown> = value as Record<string, unknown>;
		const keys = isArray
			? Array.from({ length: (value as unknown[]).length }, (_, i) => `${i}`)
			: Object.keys(source);
		const entries: [string, unknown][] = [];
		for (const key of keys) {
			try {
				entries.push([key, redactValue(source[key], depth + 1, ancestors)]);
			} catch {}
		}
		return isArray
			? entries.map(([, item]) => item)
			: Object.fromEntries(entries);
	} finally {
		ancestors.delete(value);
	}
}

function redact<T>(value: T): T {
	return redactValue(value, 0, new WeakSet()) as T;
}

function dropSensitiveRequestParts(request: NonNullable<Event["request"]>) {
	const { cookies: _cookies, data: _data, headers, ...rest } = request;
	if (!headers) return rest;
	const safeHeaders = Object.fromEntries(
		Object.entries(headers).filter(([name]) => !isDeniedHeader(name)),
	);
	return { ...rest, headers: safeHeaders };
}

function copySafeFields<T extends object>(
	source: T,
	fields: readonly (keyof T)[],
): Partial<T> {
	const copy: Partial<T> = {};
	for (const field of fields) {
		try {
			const value = source[field];
			if (
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean"
			) {
				copy[field] = value;
			}
		} catch {}
	}
	return copy;
}

export function scrubEvent<T extends Event>(event: T): T {
	try {
		const { user: _user, request, ...rest } = event;
		const stripped = request
			? { ...rest, request: dropSensitiveRequestParts(request) }
			: rest;
		return redact(stripped) as T;
	} catch {
		return {
			...copySafeFields<Event>(event, [
				"event_id",
				"timestamp",
				"level",
				"platform",
				"type",
			]),
			message: DROPPED_PLACEHOLDER,
		} as T;
	}
}

export function scrubSpan(span: StreamedSpanJSON): StreamedSpanJSON {
	try {
		const attributes = Object.fromEntries(
			Object.entries(span.attributes).filter(
				([key]) => !isIdentityAttribute(key),
			),
		);
		return redact({ ...span, attributes });
	} catch {
		return {
			is_segment: false,
			...copySafeFields<StreamedSpanJSON>(span, [
				"trace_id",
				"parent_span_id",
				"span_id",
				"start_timestamp",
				"end_timestamp",
				"status",
				"is_segment",
			]),
			name: DROPPED_PLACEHOLDER,
			attributes: {},
		} as StreamedSpanJSON;
	}
}
