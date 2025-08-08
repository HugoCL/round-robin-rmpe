"use client";

import PRReviewAssignment from "@/components/pr-review/PRReviewAssignment";
import { useParams } from "next/navigation";

export default function TeamPage() {
	const params = useParams<{ team: string }>();
	const teamSlug = params.team;
	return <PRReviewAssignment teamSlug={teamSlug} />;
}
