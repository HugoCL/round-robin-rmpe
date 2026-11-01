import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry/options";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	...sentryOptions,
});
