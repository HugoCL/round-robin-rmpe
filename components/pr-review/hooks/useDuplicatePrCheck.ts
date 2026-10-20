import { useConvex, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { parsePrUrl } from "@/lib/prUrl";

export type DuplicateAssignment = { reviewerName: string; timestamp: number };

/**
 * Whether a PR link was already assigned, live from the moment it parses: an
 * assignment or an undo made anywhere shows up without pasting the link again.
 * `submit` runs an assignment behind that check; before the first answer
 * arrives it waits for it and stops once to show the warning, so Enter cannot
 * outrun it and notify the same PR twice.
 */
export function useDuplicatePrCheck(
	teamSlug: string | undefined,
	prUrl: string,
) {
	const convex = useConvex();
	const url = parsePrUrl(prUrl) ? prUrl.trim() : null;
	const args = teamSlug && url ? { teamSlug, prUrl: url } : null;
	const existing = useQuery(api.queries.checkPRAlreadyAssigned, args ?? "skip");
	// While an assignment runs the warning keeps what it showed when it started;
	// otherwise the PR being assigned would show up as a duplicate of itself.
	const [held, setHeld] = useState<{
		duplicate: DuplicateAssignment | null;
	} | null>(null);
	const live: DuplicateAssignment | null = existing ?? null;
	const duplicate = held ? held.duplicate : live;

	const submit = async (assign: () => Promise<void>) => {
		if (args && existing === undefined) {
			const found = await convex
				.query(api.queries.checkPRAlreadyAssigned, args)
				.catch((error) => {
					console.error("Error checking for duplicate PR:", error);
					return null;
				});
			// The live answer shows the warning; this attempt only waits for it.
			if (found) return;
		}
		setHeld({ duplicate: live });
		try {
			await assign();
		} finally {
			setHeld(null);
		}
	};

	return { duplicate, submit };
}
