import assert from "node:assert/strict";
import test from "node:test";
import { isPublicRoute } from "../../proxy";

test("keeps only the intended routes public", () => {
	for (const pathname of [
		"/",
		"/es",
		"/en/sign-in",
		"/api/agent/context",
		"/api/mcp",
		"/api/updates",
		"/es/surveys/weekly/results",
		"/favicon.ico",
	]) {
		assert.equal(isPublicRoute(pathname), true, pathname);
	}

	for (const pathname of [
		"/es/create-team",
		"/api/admin",
		"/api/agent-admin",
		"/es/surveys/weekly",
	]) {
		assert.equal(isPublicRoute(pathname), false, pathname);
	}
});
