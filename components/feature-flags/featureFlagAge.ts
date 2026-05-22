export const STALE_DAYS_THRESHOLD = 90;
export const AGING_DAYS_THRESHOLD = 30;

export type StalenessLevel = "fresh" | "aging" | "stale";

export function getAgeDays(createdAt: number, now = Date.now()): number {
	const msPerDay = 1000 * 60 * 60 * 24;
	return Math.max(0, Math.floor((now - createdAt) / msPerDay));
}

export function getStalenessLevel(ageDays: number): StalenessLevel {
	if (ageDays >= STALE_DAYS_THRESHOLD) {
		return "stale";
	}
	if (ageDays >= AGING_DAYS_THRESHOLD) {
		return "aging";
	}
	return "fresh";
}

export function isStale(ageDays: number): boolean {
	return ageDays >= STALE_DAYS_THRESHOLD;
}
