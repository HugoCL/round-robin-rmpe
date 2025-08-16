"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
 
export function TeamSwitcher({ teamSlug }: { teamSlug?: string }) {
	const locale = useLocale();
	const router = useRouter();
	const teams = useQuery(api.queries.getTeams) ?? [];
	const t = useTranslations();
 
	const onChange = (value: string) => {
		router.push(`/${locale}/${value}`);
	};
 
	return (
		<Select value={teamSlug} onValueChange={onChange}>
			<SelectTrigger className="w-56">
				<SelectValue placeholder={t("placeholders.selectTeam")} />
			</SelectTrigger>
			<SelectContent>
				{teams.map((t: { _id: string; slug: string; name: string }) => (
					<SelectItem key={t._id} value={t.slug}>
						{t.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
