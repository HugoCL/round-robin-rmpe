import { spawnSync } from "node:child_process";
import { shouldRunConvexDeploy } from "./vercel-deploy-policy.mjs";

function run(command, args) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		env: process.env,
	});
	process.exit(result.status === null ? 1 : result.status);
}

if (
	shouldRunConvexDeploy({
		convexDeployKey: process.env.CONVEX_DEPLOY_KEY,
		vercelEnv: process.env.VERCEL_ENV,
	})
) {
	console.log("Deploying Convex functions, then building Next.js");
	run("npx", ["convex", "deploy", "--cmd", "npm run build"]);
} else {
	console.log(
		"Skipping Convex deploy (no usable CONVEX_DEPLOY_KEY for this environment); building Next.js only",
	);
	run("npm", ["run", "build"]);
}
