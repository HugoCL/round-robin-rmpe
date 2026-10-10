"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";

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
			{/* The second crumb after the product name: where you are, not one more
			    bordered control competing with your status. */}
			<SelectTrigger className="h-9 w-auto max-w-full rounded-full border-transparent bg-transparent px-2.5 text-sm font-medium hover:bg-muted/40 data-[state=open]:bg-muted sm:text-base dark:hover:bg-muted/50">
				<SelectValue placeholder={t("placeholders.selectTeam")} />
			</SelectTrigger>
			<SelectContent>
				{teams.map((t: { _id: string; slug: string; name: string }) => (
					<SelectItem key={t._id} value={t.slug}>
						<span className="truncate">{t.name}</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
