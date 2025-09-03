import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
	// This can either be defined statically at the top of the file or
	// asynchronously resolved from the request
	let locale = await requestLocale;

	// Ensure that the incoming locale is valid
	if (!locale || !routing.locales.includes(locale as "en" | "es")) {
		locale = routing.defaultLocale;
	}

	return {
		locale,
		messages: (await import(`../messages/${locale}.json`)).default,
	};
});
