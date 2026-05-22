import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Vercel's injected Next adapter currently crashes before compilation when
	// the build is wrapped by `convex deploy --cmd`.
	adapterPath: process.env.VERCEL ? "" : process.env.NEXT_ADAPTER_PATH,
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
	experimental: {
		viewTransition: true,
	},
};

export default withNextIntl(nextConfig);
