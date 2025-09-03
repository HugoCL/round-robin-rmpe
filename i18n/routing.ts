import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	// A list of all locales that are supported
	locales: ["en", "es"],

	// Used when no locale matches
	defaultLocale: "es",

	// The `pathnames` object holds pairs of internal and
	// external paths. Based on the locale, the external
	// paths are rewritten to the shared, internal ones.
	pathnames: {
		// If all locales use the same pathname, a single
		// string or a template string can be provided.
		// e.g. '/about' or '/users/[userId]'
		"/": "/",

		// If locales use different pathnames, you can
		// specify each external pathname per locale.
		// '/about': {
		//   en: '/about',
		//   es: '/acerca-de'
		// },

		// Dynamic params are supported via square brackets
		// '/news/[articleSlug]-[articleId]': {
		//   en: '/news/[articleSlug]-[articleId]',
		//   es: '/noticias/[articleSlug]-[articleId]'
		// },

		// Also (optional) catch-all segments are supported
		// '/categories/[...slug]': {
		//   en: '/categories/[...slug]',
		//   es: '/categorias/[...slug]'
		// }
	},
});

export const { Link, redirect, usePathname, useRouter } =
	createNavigation(routing);
