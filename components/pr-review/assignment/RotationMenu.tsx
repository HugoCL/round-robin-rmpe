import { ChevronDown, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
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
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import type { AssignmentCardTag } from "./assignmentCard.types";
import { assignmentChipClass } from "./OptionControls";

const REGULAR_VALUE = "regular";
/** Radio value of an "Otros equipos" option: the prefix plus the team slug. */
const OTHER_TEAM_VALUE_PREFIX = "team:";

type RotationMenuProps = {
	tags: AssignmentCardTag[];
	selectedTagId?: Id<"tags">;
	/** `undefined` picks the general rotation. */
	onTagChange: (tagId: Id<"tags"> | undefined) => void;
	/**
	 * With one reviewer, the menu also picks another team for them; with
	 * several, each reviewer row does.
	 */
	otherTeams?: { slug: string; name: string }[];
	selectedTeamSlug?: string;
	onTeamChange?: (teamSlug: string) => void;
	onPickSomeoneElse: () => void;
	getTagStats: (tagId: Id<"tags">) => { availableReviewers: number };
};

/**
 * One chip that names the rotation the hero shows (this team's general one or
 * a tag's, or with one reviewer another team's) and swaps it in place, so
 * choosing never adds a second control beside it.
 */
export function RotationMenu({
	tags,
	selectedTagId,
	onTagChange,
	otherTeams = [],
	selectedTeamSlug,
	onTeamChange,
	onPickSomeoneElse,
	getTagStats,
}: RotationMenuProps) {
	const t = useTranslations();
	const selectedTeam = otherTeams.find(
		(team) => team.slug === selectedTeamSlug,
	);
	const selectedTag = selectedTeam
		? undefined
		: tags.find((tag) => tag._id === selectedTagId);
	const showTeams = otherTeams.length > 0 && onTeamChange !== undefined;

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger
				className={cn(
					assignmentChipClass,
					"h-9 border text-muted-foreground hover:bg-muted/40 hover:text-foreground data-open:bg-muted/40 data-open:text-foreground",
				)}
			>
				<span className="leading-none">{t("pr.assignmentModeLabel")}</span>
				<span aria-hidden="true" className="text-border">
					·
				</span>
				{selectedTag ? (
					<span
						className="size-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: selectedTag.color }}
						aria-hidden="true"
					/>
				) : null}
				<span className="truncate font-medium leading-none text-foreground">
					{selectedTeam?.name ??
						selectedTag?.name ??
						t("pr.assignmentModeRegularShort")}
				</span>
				<ChevronDown className="size-4 shrink-0" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuRadioGroup
					value={
						selectedTeam
							? `${OTHER_TEAM_VALUE_PREFIX}${selectedTeam.slug}`
							: (selectedTagId ?? REGULAR_VALUE)
					}
					onValueChange={(value) => {
						if (value.startsWith(OTHER_TEAM_VALUE_PREFIX)) {
							onTeamChange?.(value.slice(OTHER_TEAM_VALUE_PREFIX.length));
							return;
						}
						onTagChange(
							value === REGULAR_VALUE ? undefined : (value as Id<"tags">),
						);
					}}
				>
					<DropdownMenuGroup>
						<DropdownMenuLabel>
							{showTeams ? t("pr.ownTeamGroup") : t("pr.assignmentModeLabel")}
						</DropdownMenuLabel>
						<DropdownMenuRadioItem value={REGULAR_VALUE}>
							{t("pr.assignmentModeRegularShort")}
						</DropdownMenuRadioItem>
						{tags.map((tag) => (
							<DropdownMenuRadioItem key={tag._id} value={tag._id}>
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: tag.color }}
									aria-hidden="true"
								/>
								{t("tags.optionAvailable", {
									name: tag.name,
									count: getTagStats(tag._id as Id<"tags">).availableReviewers,
								})}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuGroup>
					{showTeams ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>{t("pr.otherTeamsGroup")}</DropdownMenuLabel>
								{otherTeams.map((team) => (
									<DropdownMenuRadioItem
										key={team.slug}
										value={`${OTHER_TEAM_VALUE_PREFIX}${team.slug}`}
									>
										{team.name}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuGroup>
						</>
					) : null}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onPickSomeoneElse}>
					<UserCheck />
					{t("pr.forceAssignAction")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
