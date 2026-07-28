import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL,
		browserName: "chromium",
		trace: "retain-on-failure",
	},
	webServer: {
		command: `node_modules/.bin/next dev --turbopack --hostname localhost --port ${port}`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			NEXT_PUBLIC_ALLOW_CLERK_TEST_EMAILS: "true",
		},
	},
});
