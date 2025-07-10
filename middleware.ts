import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

// Create the internationalization middleware
const intlMiddleware = createMiddleware(routing);

// Create the AuthKit middleware
const authMiddleware = authkitMiddleware({
	middlewareAuth: {
		enabled: true,
		unauthenticatedPaths: [
			"/api/updates",
			"/favicon.ico",
			"/en/callback",
			"/es/callback"
		],
	},
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
	// First, run the AuthKit middleware to ensure withAuth coverage
	const authResponse = await authMiddleware(request, event);

	// If AuthKit returns a redirect response, return it immediately
	if (authResponse && (authResponse.status === 302 || authResponse.status === 307)) {
		return authResponse;
	}

	// Handle i18n routing
	const intlResponse = intlMiddleware(request);
	if (intlResponse) {
		// If i18n middleware returns a response, copy headers from auth response
		if (authResponse) {
			authResponse.headers.forEach((value, key) => {
				intlResponse.headers.set(key, value);
			});
		}
		return intlResponse;
	}

	// Return the auth response or continue
	return authResponse || NextResponse.next();
}

export const config = {
	matcher: [
		// Enable a redirect to a matching locale at the root
		'/',
		// Set a cookie to remember the previous locale for all requests that have a locale prefix
		'/(es|en)/:path*',
		// Enable redirects that add missing locales
		'/((?!_next|_vercel|.*\\..*).*)',
		// Include API routes for auth
		'/api/:path*',
	]
};
