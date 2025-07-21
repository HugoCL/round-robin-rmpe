import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Create the internationalization middleware
const intlMiddleware = createMiddleware(routing);

// Define public routes (include both with and without locale prefixes)
const isPublicRoute = createRouteMatcher([
	"/",
	"/api/updates",
	"/sign-in(.*)",
	"/sign-up(.*)",
	"/(es|en)/sign-in(.*)",
	"/(es|en)/sign-up(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
	// Protect all routes except public ones
	if (!isPublicRoute(req)) {
		await auth.protect();
	}

	// Handle i18n routing for non-auth API routes
	if (!req.nextUrl.pathname.startsWith('/api/') || req.nextUrl.pathname.startsWith('/api/updates')) {
		return intlMiddleware(req);
	}
});

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
