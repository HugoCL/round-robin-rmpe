/**
 * Shapes the diagnostic sent when the board cannot confirm a Convex session.
 *
 * The Clerk token itself never leaves this module: callers pass it in, and the
 * report keeps only iss, aud, iat and exp.
 */

const JWT_PATTERN =
	/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const DEV_BROWSER_PATTERN = /__clerk_db_jwt=[^&\s]+/g;

const LIMITS = {
	userId: 128,
	email: 320,
	error: 300,
	iss: 200,
	aud: 120,
	route: 300,
	userAgent: 300,
} as const;

const CLOCK_SKEW_SUSPECT_MS = 60_000;
const MAX_RETRY_COUNT = 100;

export const SESSION_UNVERIFIED_RETRY_KEY =
	"la-lista:session-unverified-retries";

export type TokenStatus = "present" | "missing" | "error";

export type ConvexTokenClaims = {
	iss?: string;
	aud?: string;
	iat?: number;
	exp?: number;
};

export type UnverifiedSessionReport = {
	clientTimestamp: number;
	tokenStatus: TokenStatus;
	route: string;
	userAgent: string;
	retryCount: number;
	clerkUserId?: string;
	clerkEmail?: string;
	tokenError?: string;
	iss?: string;
	aud?: string;
	iat?: number;
	exp?: number;
};

type ReportStorage = Pick<Storage, "getItem" | "setItem">;

export function scrubSecrets(value: string): string {
	return value
		.replace(JWT_PATTERN, "[redacted]")
		.replace(DEV_BROWSER_PATTERN, "__clerk_db_jwt=[redacted]");
}

export function readConvexTokenClaims(token: string): ConvexTokenClaims | null {
	const payload = token.split(".")[1];
	if (!payload) return null;
	try {
		const parsed: unknown = JSON.parse(decodeBase64Url(payload));
		if (typeof parsed !== "object" || parsed === null) return null;
		const record = parsed as Record<string, unknown>;
		const claims: ConvexTokenClaims = {};
		if (typeof record.iss === "string") claims.iss = record.iss;
		const aud = readAudience(record.aud);
		if (aud) claims.aud = aud;
		if (isFiniteNumber(record.iat)) claims.iat = record.iat;
		if (isFiniteNumber(record.exp)) claims.exp = record.exp;
		return claims;
	} catch {
		return null;
	}
}

export function consumeRetryCount(storage: ReportStorage): number {
	try {
		const raw = storage.getItem(SESSION_UNVERIFIED_RETRY_KEY);
		const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
		const count =
			Number.isFinite(parsed) && parsed > 0
				? Math.min(Math.floor(parsed), MAX_RETRY_COUNT)
				: 0;
		storage.setItem(SESSION_UNVERIFIED_RETRY_KEY, String(count + 1));
		return count;
	} catch {
		return 0;
	}
}

export async function collectUnverifiedSessionReport(input: {
	getToken: () => Promise<string | null>;
	clerkUserId?: string;
	clerkEmail?: string;
	clientTimestamp: number;
	route: string;
	userAgent: string;
	retryCount: number;
}): Promise<UnverifiedSessionReport> {
	const report: UnverifiedSessionReport = {
		clientTimestamp: input.clientTimestamp,
		tokenStatus: "missing",
		route: clipRequired(input.route, LIMITS.route),
		userAgent: clipRequired(input.userAgent, LIMITS.userAgent),
		retryCount: clampRetry(input.retryCount),
	};
	assignOptional(report, "clerkUserId", input.clerkUserId, LIMITS.userId);
	assignOptional(report, "clerkEmail", input.clerkEmail, LIMITS.email);

	try {
		const token = await input.getToken();
		if (typeof token !== "string" || token.length === 0) return report;
		report.tokenStatus = "present";
		const claims = readConvexTokenClaims(token);
		if (!claims) {
			report.tokenError = "Could not decode token payload";
			return report;
		}
		assignOptional(report, "iss", claims.iss, LIMITS.iss);
		assignOptional(report, "aud", claims.aud, LIMITS.aud);
		if (claims.iat !== undefined) report.iat = claims.iat;
		if (claims.exp !== undefined) report.exp = claims.exp;
		return report;
	} catch (error) {
		report.tokenStatus = "error";
		report.tokenError =
			clipOptional(errorMessage(error), LIMITS.error) ?? "getToken failed";
		return report;
	}
}

export function formatUnverifiedSessionLog(
	report: UnverifiedSessionReport,
	serverNow: number,
): string {
	const clientTimestamp = isFiniteNumber(report.clientTimestamp)
		? report.clientTimestamp
		: null;
	const skewMs = clientTimestamp === null ? null : serverNow - clientTimestamp;
	const expMs = isFiniteNumber(report.exp) ? report.exp * 1000 : null;
	const iatMs = isFiniteNumber(report.iat) ? report.iat * 1000 : null;
	const payload = {
		event: "sessionUnverified",
		serverNow,
		clientTimestamp,
		skewMs,
		clockSkewSuspected:
			skewMs === null ? null : Math.abs(skewMs) > CLOCK_SKEW_SUSPECT_MS,
		clerkUserId: clipOptional(report.clerkUserId, LIMITS.userId),
		clerkEmail: clipOptional(report.clerkEmail, LIMITS.email),
		tokenStatus: report.tokenStatus,
		tokenError: clipOptional(report.tokenError, LIMITS.error),
		iss: clipOptional(report.iss, LIMITS.iss),
		aud: clipOptional(report.aud, LIMITS.aud),
		iat: iatMs === null ? null : report.iat,
		exp: expMs === null ? null : report.exp,
		tokenExpired: expMs === null ? null : expMs <= serverNow,
		iatInFuture: iatMs === null ? null : iatMs > serverNow,
		route: clipRequired(report.route, LIMITS.route),
		userAgent: clipRequired(report.userAgent, LIMITS.userAgent),
		retryCount: clampRetry(report.retryCount),
	};
	return `[sessionUnverified] ${JSON.stringify(payload)}`;
}

function assignOptional(
	report: UnverifiedSessionReport,
	key: "clerkUserId" | "clerkEmail" | "iss" | "aud",
	value: string | undefined,
	max: number,
) {
	const clipped = clipOptional(value, max);
	if (clipped) report[key] = clipped;
}

function clipOptional(value: string | undefined, max: number): string | null {
	if (!value) return null;
	const scrubbed = scrubSecrets(value).trim();
	if (!scrubbed) return null;
	return scrubbed.length > max ? scrubbed.slice(0, max) : scrubbed;
}

function clipRequired(value: string, max: number): string {
	return clipOptional(value, max) ?? "";
}

function clampRetry(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.min(Math.floor(value), MAX_RETRY_COUNT);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function readAudience(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((item) => typeof item === "string")
	) {
		return value.join(",");
	}
	return undefined;
}

function decodeBase64Url(segment: string): string {
	const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
	const padding = (4 - (base64.length % 4)) % 4;
	return atob(base64.padEnd(base64.length + padding, "="));
}

function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return "getToken failed";
}
