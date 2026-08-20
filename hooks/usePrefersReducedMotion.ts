"use client";

import { useEffect, useState } from "react";

type MatchMediaWithLegacySupport = MediaQueryList & {
	addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
	removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

export function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		) as MatchMediaWithLegacySupport;
		const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

		updatePreference();
		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", updatePreference);
			return () => mediaQuery.removeEventListener("change", updatePreference);
		}

		mediaQuery.addListener?.(updatePreference);
		return () => mediaQuery.removeListener?.(updatePreference);
	}, []);

	return prefersReducedMotion;
}
