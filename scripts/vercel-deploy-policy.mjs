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

export function shouldSkipVercelBuild({ projectId } = {}) {
	return projectId === DEMO_VERCEL_PROJECT_ID;
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
