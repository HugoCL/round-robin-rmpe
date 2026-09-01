import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query from React. Starts `false` so server and first client
 * render agree, then settles on the real value after mount.
 */
export function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(query);
		const update = () => setMatches(mediaQuery.matches);

		update();
		mediaQuery.addEventListener("change", update);
		return () => mediaQuery.removeEventListener("change", update);
	}, [query]);

	return matches;
}
