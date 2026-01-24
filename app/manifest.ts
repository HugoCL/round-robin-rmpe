import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "La Lista",
		short_name: "La Lista",
		description:
			"Herramienta de asignación de revisores de PRs y gestión de eventos de equipo",
		start_url: "/",
		display: "standalone",
		background_color: "#0a0a0a",
		theme_color: "#3b82f6",
		icons: [
			{
				src: "/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	};
}
