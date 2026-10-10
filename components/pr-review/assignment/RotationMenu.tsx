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

type RotationMenuProps = {
	tags: AssignmentCardTag[];
	selectedTagId?: Id<"tags">;
	/** `undefined` picks the general rotation. */
	onTagChange: (tagId: Id<"tags"> | undefined) => void;
	onPickSomeoneElse: () => void;
	getTagStats: (tagId: Id<"tags">) => { availableReviewers: number };
};

/**
 * One chip that names the rotation the hero shows (general or a tag's) and
 * swaps it in place, so choosing never adds a second control beside it.
 */
export function RotationMenu({
	tags,
	selectedTagId,
	onTagChange,
	onPickSomeoneElse,
	getTagStats,
}: RotationMenuProps) {
	const t = useTranslations();
	const selectedTag = tags.find((tag) => tag._id === selectedTagId);

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
					{selectedTag?.name ?? t("pr.assignmentModeRegularShort")}
				</span>
				<ChevronDown className="size-4 shrink-0" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t("pr.assignmentModeLabel")}</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={selectedTagId ?? REGULAR_VALUE}
						onValueChange={(value) =>
							onTagChange(
								value === REGULAR_VALUE ? undefined : (value as Id<"tags">),
							)
						}
					>
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
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onPickSomeoneElse}>
					<UserCheck />
					{t("pr.forceAssignAction")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
