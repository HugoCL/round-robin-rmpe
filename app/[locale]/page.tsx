"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import CreateTeamForm from "@/components/CreateTeamForm";
import PRReviewAssignment from "@/components/pr-review/PRReviewAssignment";
import { api } from "@/convex/_generated/api";

export default function Page() {
	const router = useRouter();
	const locale = useLocale();
	const teams = useQuery(api.queries.getTeams) ?? [];

	useEffect(() => {
		if (teams.length > 0) {
			router.replace(`/${locale}/${teams[0].slug}`);
		}
	}, [teams, router, locale]);

	// If no teams, show create team form; otherwise, show fallback while redirecting
	if (teams.length === 0) {
		return <CreateTeamForm />;
	}

	return <PRReviewAssignment />;
}
