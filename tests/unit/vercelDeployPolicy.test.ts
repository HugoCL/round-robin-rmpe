import assert from "node:assert/strict";
import test from "node:test";
import {
	DEMO_VERCEL_PROJECT_ID,
	shouldRunConvexDeploy,
	shouldSkipVercelBuild,
} from "../../scripts/vercel-deploy-policy.mjs";

test("skips only the leftover demo Vercel project", () => {
	assert.equal(
		shouldSkipVercelBuild({ projectId: DEMO_VERCEL_PROJECT_ID }),
		true,
	);
	assert.equal(
		shouldSkipVercelBuild({ projectId: "prj_zDdUvumm7d7kb9zaEgtIqdepyeDt" }),
		false,
	);
	assert.equal(shouldSkipVercelBuild({}), false);
});

test("runs Convex deploy when a non-production preview key is present", () => {
	assert.equal(
		shouldRunConvexDeploy({
			convexDeployKey: "preview:team|secret",
			vercelEnv: "preview",
		}),
		true,
	);
	assert.equal(
		shouldRunConvexDeploy({
			convexDeployKey: "prod:deployment|secret",
			vercelEnv: "production",
		}),
		true,
	);
});

test("skips Convex deploy when preview would use a production key or none", () => {
	assert.equal(
		shouldRunConvexDeploy({
			convexDeployKey: "prod:deployment|secret",
			vercelEnv: "preview",
		}),
		false,
	);
	assert.equal(
		shouldRunConvexDeploy({
			convexDeployKey: "",
			vercelEnv: "preview",
		}),
		false,
	);
	assert.equal(shouldRunConvexDeploy({ vercelEnv: "production" }), false);
});
