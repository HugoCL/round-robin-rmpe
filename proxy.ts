import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Create the internationalization middleware
const intlMiddleware = createMiddleware(routing);

const PUBLIC_ROUTE_PATTERNS = [
	/^\/$/,
	/^\/(?:es|en)\/?$/,
	/^\/api\/(?:agent(?:\/.*)?|mcp(?:\/.*)?|updates\/?)$/,
	/^\/(?:(?:es|en)\/)?sign-(?:in|up)(?:\/.*)?$/,
	/^\/(?:(?:es|en)\/)?surveys\/[^/]+\/results(?:\/.*)?$/,
	/^\/(?:icon|apple-icon).*$/,
	/^\/(?:favicon\.ico|robots\.txt|sitemap\.xml)$/,
];

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export default clerkMiddleware(async (auth, req) => {
	// Protect all routes except public ones
	if (!isPublicRoute(req.nextUrl.pathname)) {
		await auth.protect();
	}

	// Handle i18n routing for non-auth API routes
	if (
		!req.nextUrl.pathname.startsWith("/api/") ||
		req.nextUrl.pathname.startsWith("/api/updates")
	) {
		return intlMiddleware(req);
	}

	return NextResponse.next();
});

export const config = {
	matcher: [
		// Enable a redirect to a matching locale at the root
		"/",
		// Set a cookie to remember the previous locale for all requests that have a locale prefix
		"/(es|en)/:path*",
		// Enable redirects that add missing locales
		// Exclude Next.js app icons/metadata routes and files with extensions
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Include API routes for auth
		"/api/:path*",
	],
};

// Next.js 16: named export `middleware` is deprecated.
// Rename it to `proxy` only if/when we stop using Clerk's `clerkMiddleware` wrapper.
