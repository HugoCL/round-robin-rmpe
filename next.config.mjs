import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Vercel's injected Next adapter currently crashes before compilation when
	// the build is wrapped by `convex deploy --cmd`.
	adapterPath: process.env.VERCEL ? "" : process.env.NEXT_ADAPTER_PATH,
	// Emit `.next/standalone` for the self-hosted Docker image. Left off by
	// default so Vercel builds keep their own output handling.
	output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
	turbopack: {
		root: process.cwd(),
	},
	typescript: {
		ignoreBuildErrors: false,
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
		],
	},
};

export default withSentryConfig(withNextIntl(nextConfig), {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	authToken: process.env.SENTRY_AUTH_TOKEN,
	silent: !process.env.CI,
	widenClientFileUpload: true,
	telemetry: false,
});
