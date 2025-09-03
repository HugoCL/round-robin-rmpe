import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { usePRReview } from "@/components/pr-review/PRReviewContext";
import { api } from "@/convex/_generated/api";

export function useMyAssignments() {
	const { userInfo, teamSlug } = usePRReview();
	const email = userInfo?.email;

	const assignedToMe = useQuery(
		api.queries.getActiveAssignmentsForReviewer,
		email && teamSlug ? { teamSlug, email } : "skip",
	);
	const iAssigned = useQuery(
		api.queries.getActiveAssignmentsByReviewer,
		email && teamSlug ? { teamSlug, email } : "skip",
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
