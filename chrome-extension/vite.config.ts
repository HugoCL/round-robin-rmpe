import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const DEFAULTS = {
	VITE_CONVEX_SITE_URL: "https://admired-weasel-950.convex.site",
	VITE_CLERK_PUBLISHABLE_KEY:
		"pk_test_dGlkeS1zdGluZ3JheS04MS5jbGVyay5hY2NvdW50cy5kZXYk",
	VITE_SYNC_HOST: "https://la-lista.vercel.app",
};

/** `https://host:1234/path` -> `https://host:1234/*` */
function originPattern(url: string): string | null {
	try {
		return `${new URL(url).origin}/*`;
	} catch {
		return null;
	}
}

/**
 * A Clerk publishable key is `pk_<env>_<base64 of "frontend-api-host$">`, so
 * the host permission the extension needs follows from the key itself.
 */
function clerkOriginPattern(publishableKey: string): string | null {
	const encoded = publishableKey.split("_").slice(2).join("_");
	if (!encoded) return null;
	try {
		const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$+$/, "");
		return host ? `https://${host}/*` : null;
	} catch {
		return null;
	}
}

/**
 * Rewrites `host_permissions` in the emitted manifest so it matches whatever
 * backend this build points at. Without it, a self-hosted build is blocked by
 * MV3 from reaching its own Convex deployment.
 */
function syncManifestHosts(env: Record<string, string>): Plugin {
	return {
		name: "la-lista-sync-manifest-hosts",
		apply: "build",
		closeBundle() {
			const target = resolve(import.meta.dirname, "dist/manifest.json");
			const manifest = JSON.parse(readFileSync(target, "utf8"));
			const pick = (k: keyof typeof DEFAULTS) => env[k] || DEFAULTS[k];

			manifest.host_permissions = [
				"https://github.com/*",
				clerkOriginPattern(pick("VITE_CLERK_PUBLISHABLE_KEY")),
				originPattern(pick("VITE_SYNC_HOST")),
				originPattern(pick("VITE_CONVEX_SITE_URL")),
				"http://localhost/*",
			].filter((v): v is string => Boolean(v));

			writeFileSync(target, `${JSON.stringify(manifest, null, "\t")}\n`);
			// biome-ignore lint/suspicious/noConsole: build-time diagnostics
			console.log(
				`manifest host_permissions: ${manifest.host_permissions.join(", ")}`,
			);
		},
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, import.meta.dirname, "VITE_");
	return {
		plugins: [react(), tailwindcss(), syncManifestHosts(env)],
		base: "./",
		resolve: {
			alias: {
				"@": resolve(import.meta.dirname, "src"),
			},
		},
		build: {
			outDir: "dist",
			emptyOutDir: true,
			rolldownOptions: {
				input: {
					popup: resolve(import.meta.dirname, "popup.html"),
					background: resolve(import.meta.dirname, "src/background.ts"),
					content: resolve(import.meta.dirname, "src/content.ts"),
				},
				output: {
					entryFileNames: "[name].js",
					chunkFileNames: "chunks/[name]-[hash].js",
					assetFileNames: "assets/[name]-[hash].[ext]",
				},
			},
		},
	};
});
