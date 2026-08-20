import { shouldSkipVercelBuild } from "./vercel-deploy-policy.mjs";

// Exit 0 skips the Vercel build; exit 1 proceeds.
// https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
if (
	shouldSkipVercelBuild({
		projectId: process.env.VERCEL_PROJECT_ID,
		vercelEnv: process.env.VERCEL_ENV,
	})
) {
	console.log(
		`Skipping leftover Vercel project ${process.env.VERCEL_PROJECT_ID} (${process.env.VERCEL_ENV ?? "unknown env"})`,
	);
	process.exit(0);
}

process.exit(1);
