/**
 * Decide whether a Vercel build should run `npx convex deploy`.
 *
 * Convex's documented Vercel setup uses `npx convex deploy --cmd 'npm run build'`
 * with a Production deploy key on Production only. Preview builds then fail with
 * "CONVEX_DEPLOY_KEY is not set" or "production Convex deployment" unless a
 * Preview deploy key is also configured.
 *
 * This repo is connected to three Vercel projects. Only rmpe-pr has a working
 * Preview key. The others should still compile Next.js instead of failing CI.
 */

export const DEMO_VERCEL_PROJECT_ID = "prj_LQSXUV5i3ToUZQx2k3WUexhAd3Yo";
export const V0_VERCEL_PROJECT_ID = "prj_hXvIh4xPp580l6QrGTkw1J4qBsjk";

export function shouldSkipVercelBuild({ projectId, vercelEnv } = {}) {
	if (projectId === DEMO_VERCEL_PROJECT_ID) {
		return true;
	}
	// Production on this leftover v0 project still succeeds; Preview does not
	// because the dashboard build command is `npx convex deploy` with a
	// Production-only CONVEX_DEPLOY_KEY.
	if (projectId === V0_VERCEL_PROJECT_ID && vercelEnv !== "production") {
		return true;
	}
	return false;
}

export function shouldRunConvexDeploy({ convexDeployKey, vercelEnv } = {}) {
	if (!convexDeployKey) {
		return false;
	}
	if (vercelEnv === "preview" && convexDeployKey.startsWith("prod:")) {
		return false;
	}
	return true;
}
