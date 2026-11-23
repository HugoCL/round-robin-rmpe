import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { usePRReview } from "@/components/pr-review/PRReviewContext";
import { api } from "@/convex/_generated/api";

export function useMyAssignments() {
	const { userInfo, teamSlug } = usePRReview();
	// The server reads who is asking from the session; this only skips the
	// queries while nobody is signed in.
	const signedIn = Boolean(userInfo?.email);

	const assignedToMe = useQuery(
		api.queries.getActiveAssignmentsForReviewer,
		signedIn && teamSlug ? { teamSlug } : "skip",
	);
	const iAssigned = useQuery(
		api.queries.getActiveAssignmentsByReviewer,
		signedIn && teamSlug ? { teamSlug } : "skip",
	);

	const complete = useMutation(api.mutations.completePRAssignment);

	return useMemo(
		() => ({
			assignedToMe: assignedToMe || [],
			iAssigned: iAssigned || [],
			complete,
			loading: !assignedToMe || !iAssigned,
		}),
		[assignedToMe, iAssigned, complete],
	);
}
