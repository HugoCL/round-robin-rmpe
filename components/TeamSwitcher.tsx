"use client";

import { useQuery } from "convex/react";
import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { groupTeamsByMembership } from "@/lib/teamMembership";

export function TeamSwitcher({ teamSlug }: { teamSlug?: string }) {
	const locale = useLocale();
	const router = useRouter();
	const t = useTranslations();
	const teams = useQuery(api.queries.getTeams) ?? [];
	const access = useQuery(api.queries.getMyTeamAccess, { teamSlug });
	const { mine, others } = groupTeamsByMembership(
		teams,
		access?.memberTeamSlugs ?? [],
	);
	const currentTeam = teams.find((team) => team.slug === teamSlug);

	const teamItems = (group: typeof teams) =>
		group.map((team) => (
			<DropdownMenuRadioItem key={team._id} value={team.slug}>
				<span className="truncate">{team.name}</span>
			</DropdownMenuRadioItem>
		));

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				{/* The second crumb after the product name: where you are, not one more
				    bordered control competing with your status. */}
				<Button
					variant="ghost"
					aria-label={
						currentTeam
							? t("team.switcher.triggerLabel", { team: currentTeam.name })
							: undefined
					}
					className="h-9 max-w-full gap-1.5 rounded-full px-2.5 text-sm font-medium hover:bg-muted/40 data-open:bg-muted sm:text-base dark:hover:bg-muted/50"
				>
					<span className="truncate">
						{currentTeam?.name ?? t("placeholders.selectTeam")}
					</span>
					<ChevronsUpDown
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuRadioGroup
					value={teamSlug}
					onValueChange={(slug) => router.push(`/${locale}/${slug}`)}
				>
					{mine.length > 0 ? (
						<DropdownMenuGroup>
							<DropdownMenuLabel>
								{t("team.switcher.myTeamsGroup")}
							</DropdownMenuLabel>
							{teamItems(mine)}
						</DropdownMenuGroup>
					) : null}
					{mine.length > 0 && others.length > 0 ? (
						<DropdownMenuSeparator />
					) : null}
					{others.length > 0 ? (
						<DropdownMenuGroup>
							{mine.length > 0 ? (
								<DropdownMenuLabel>
									{t("team.switcher.otherTeamsGroup")}
								</DropdownMenuLabel>
							) : null}
							{teamItems(others)}
						</DropdownMenuGroup>
					) : null}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={`/${locale}/create-team`}>
						<Plus />
						{t("team.createButton")}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
