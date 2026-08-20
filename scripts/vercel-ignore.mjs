import { shouldSkipVercelBuild } from "./vercel-deploy-policy.mjs";

// Exit 0 skips the Vercel build; exit 1 proceeds.
// https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
if (shouldSkipVercelBuild({ projectId: process.env.VERCEL_PROJECT_ID })) {
	console.log(
		"Skipping round-robin-rmpe-demo: this leftover Vercel project is not configured to build the app",
	);
	process.exit(0);
}

process.exit(1);
