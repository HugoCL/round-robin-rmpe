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
	"/(es|en)/sign-up(.*)",
	// App Router icon routes and common static files should be public and not localized
	"/icon(.*)",
	"/apple-icon(.*)",
	"/favicon.ico",
	"/robots.txt",
	"/sitemap.xml",
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
		// Exclude Next.js app icons/metadata routes and files with extensions
		'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
		// Include API routes for auth
		'/api/:path*',
	]
};
