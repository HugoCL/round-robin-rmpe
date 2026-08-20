"use client";

import { useEffect, useState } from "react";

export function useRotatingIndex(
	length: number,
	intervalMs: number,
	enabled: boolean,
) {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (!enabled || length <= 1) return;

		const id = window.setInterval(() => {
			setIndex((current) => (current + 1) % length);
		}, intervalMs);

		return () => window.clearInterval(id);
	}, [enabled, intervalMs, length]);

	return [index, setIndex] as const;
}
