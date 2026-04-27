import { Info, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextMorph } from "torph/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Id } from "@/convex/_generated/dataModel";
import type { Reviewer } from "@/lib/types";
import type { AssignmentCardTag, AssignmentMode } from "./assignmentCard.types";

type AssignmentHeroPanelProps = {
	mode: AssignmentMode;
	lastAssignedReviewer: Reviewer | null;
	isAssigning: boolean;
	activeNextReviewer: Reviewer | null;
	selectedTag?: AssignmentCardTag;
	userEmail?: string;
	upcomingReviewer: Reviewer | null;
	selectedTagId?: Id<"tags">;
	isLoadingTagReviewer: boolean;
};

export function AssignmentHeroPanel({
	mode,
	lastAssignedReviewer,
	isAssigning,
	activeNextReviewer,
	selectedTag,
	userEmail,
	upcomingReviewer,
	selectedTagId,
	isLoadingTagReviewer,
}: AssignmentHeroPanelProps) {
	const t = useTranslations();

	if (!activeNextReviewer) {
		return (
			<div className="w-full rounded-[2rem] border border-dashed border-border/70 bg-muted/22 p-8 text-center lg:p-10">
				{mode === "tag" ? (
					selectedTagId ? (
						<p className="text-sm text-muted-foreground lg:text-base">
							{isLoadingTagReviewer
								? t("tags.findingNextReviewer")
								: t("tags.noAvailableReviewers")}
						</p>
					) : (
						<p className="text-sm text-muted-foreground lg:text-base">
							{t("tags.selectTag")}
						</p>
					)
				) : (
					<>
						<h3 className="mb-2 text-xl font-medium text-muted-foreground lg:text-2xl">
							{t("pr.noAvailableReviewersTitle")}
						</h3>
						<p className="text-sm text-muted-foreground lg:text-base">
							{t("pr.allReviewersAbsent")}
						</p>
					</>
				)}
			</div>
		);
	}

	return (
		<div className="w-full overflow-hidden py-6 text-center md:py-8 2xl:py-10">
			<div className="flex flex-col gap-6 2xl:gap-8">
				{mode === "regular" && lastAssignedReviewer && (
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground lg:text-sm">
							{t("pr.lastAssigned")}
						</span>
						<h4
							className={`text-lg font-medium text-muted-foreground opacity-80 transition-opacity duration-300 motion-reduce:transition-none lg:text-xl ${
								isAssigning ? "opacity-0" : "opacity-80"
							}`}
						>
							<TextMorph ease={{ stiffness: 200, damping: 20 }}>
								{lastAssignedReviewer.name}
							</TextMorph>
						</h4>
					</div>
				)}

				<div className="flex flex-col gap-3">
					<div>
						<span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25 lg:text-sm dark:bg-white/12 dark:text-white dark:ring-white/20">
							<Sparkles className="h-3 w-3" aria-hidden="true" />
							{mode === "tag" ? t("tags.nextReviewer") : t("pr.nextReviewer")}
						</span>
					</div>
					<div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-primary/16 bg-gradient-to-br from-primary/14 via-background to-primary/8 p-7 shadow-[0_28px_72px_-44px_rgba(37,99,235,0.55)] ring-1 ring-primary/12 md:p-8 2xl:max-w-3xl 2xl:p-10 dark:border-primary/18 dark:from-primary/20 dark:via-background dark:to-primary/10 dark:ring-primary/22">
						<div
							className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.25),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.22),transparent_45%)]"
							aria-hidden
						/>
						<div className="relative flex flex-col gap-2">
							<h3
								className={`break-words text-4xl font-bold text-primary drop-shadow-lg transition-transform transition-opacity duration-300 motion-reduce:transition-none md:text-5xl 2xl:text-6xl dark:text-white ${
									isAssigning
										? "translate-y-1 opacity-0"
										: "translate-y-0 opacity-100"
								}`}
							>
								<TextMorph ease={{ stiffness: 200, damping: 20 }}>
									{activeNextReviewer.name}
								</TextMorph>
							</h3>
							{mode === "tag" && selectedTag && (
								<div className="flex justify-center">
									<Badge
										variant="secondary"
										style={{
											backgroundColor: `${selectedTag.color}20`,
											color: selectedTag.color,
											borderColor: selectedTag.color,
										}}
									>
										{selectedTag.name}
									</Badge>
								</div>
							)}
						</div>
					</div>
				</div>

				{userEmail &&
					activeNextReviewer.email.toLowerCase() ===
						userEmail.toLowerCase() && (
						<Alert className="border-border/60 bg-muted/35">
							<Info className="h-4 w-4 self-center text-muted-foreground" />
							<AlertTitle className="text-sm text-foreground lg:text-base">
								{t("pr.autoSkipTitle")}
							</AlertTitle>
							<AlertDescription className="text-sm text-muted-foreground lg:text-base">
								{upcomingReviewer ? (
									<>
										{t("pr.autoSkipDescriptionPrefix")}{" "}
										<TextMorph ease={{ stiffness: 200, damping: 20 }}>
											{upcomingReviewer.name}
										</TextMorph>{" "}
										{t("pr.autoSkipDescriptionSuffix")}
									</>
								) : (
									t("pr.autoSkipDescriptionNoNext")
								)}
							</AlertDescription>
						</Alert>
					)}

				{upcomingReviewer && (
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground lg:text-sm">
							{t("pr.upNext")}
						</span>
						<h4 className="text-lg font-medium text-muted-foreground opacity-80 lg:text-xl">
							<TextMorph ease={{ stiffness: 200, damping: 20 }}>
								{upcomingReviewer.name}
							</TextMorph>
						</h4>
					</div>
				)}
			</div>
		</div>
	);
}
