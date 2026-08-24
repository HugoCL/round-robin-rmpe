import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
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
});
