import { useQuery } from "convex/react";
import { Clock3, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextMorph } from "torph/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { reviewerHasBirthdayToday } from "@/lib/reviewerAvailability";
import type { Reviewer } from "@/lib/types";
import { usePRReview } from "../PRReviewContext";
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
	const { teamSlug } = usePRReview();

	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");
	const teamTimezone = team?.timezone ?? "UTC";

	const activeHasBirthday =
		activeNextReviewer &&
		reviewerHasBirthdayToday(activeNextReviewer, teamTimezone);
	const lastHasBirthday =
		lastAssignedReviewer &&
		reviewerHasBirthdayToday(lastAssignedReviewer, teamTimezone);
	const upcomingHasBirthday =
		upcomingReviewer &&
		reviewerHasBirthdayToday(upcomingReviewer, teamTimezone);

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
		<div className="w-full overflow-hidden py-1 text-center sm:py-3 md:py-4 2xl:py-5">
			<div className="flex flex-col gap-2 sm:gap-3 2xl:gap-4">
				{mode === "regular" && lastAssignedReviewer && (
					<div className="flex flex-wrap items-center justify-center gap-2 text-center">
						<Clock3
							className="h-4 w-4 text-muted-foreground"
							aria-hidden="true"
						/>
						<span className="text-sm text-muted-foreground">
							{t("pr.lastAssigned")}:
						</span>
						<h4
							className={`inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-opacity duration-300 motion-reduce:transition-none lg:text-base ${
								isAssigning ? "opacity-0" : "opacity-80"
							}`}
						>
							<TextMorph ease={{ stiffness: 200, damping: 20 }}>
								{lastAssignedReviewer.name}
							</TextMorph>
							{lastHasBirthday && <Badge variant="secondary">🎂 HBD</Badge>}
						</h4>
					</div>
				)}

				<div className="flex flex-col gap-1 sm:gap-2">
					<div>
						<span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25 lg:text-sm">
							{mode === "tag" ? t("tags.nextReviewer") : t("pr.nextReviewer")}
						</span>
					</div>
					<div className="relative mx-auto flex min-h-24 w-full items-center justify-center px-4 py-2 sm:min-h-36 sm:px-8 sm:py-4 md:min-h-44 md:px-12 2xl:min-h-52 2xl:px-16">
						<span
							className="pointer-events-none absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-primary"
							aria-hidden="true"
						/>
						<span
							className="pointer-events-none absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-primary"
							aria-hidden="true"
						/>
						<span
							className="pointer-events-none absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-primary"
							aria-hidden="true"
						/>
						<span
							className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-primary"
							aria-hidden="true"
						/>
						<div className="relative flex flex-col gap-2 sm:gap-3">
							<h3
								className={`inline-flex w-full max-w-full flex-wrap items-center justify-center gap-2.5 break-words text-4xl font-bold leading-[1.05] text-primary transition-transform transition-opacity duration-300 sm:text-5xl md:text-6xl xl:text-7xl 2xl:text-8xl motion-reduce:transition-none ${
									isAssigning
										? "translate-y-1 opacity-0"
										: "translate-y-0 opacity-100"
								}`}
							>
								<span className="w-full text-balance text-center sm:hidden">
									{activeNextReviewer.name}
								</span>
								<span className="hidden sm:inline">
									<TextMorph
										className="max-w-full !whitespace-normal !text-center"
										ease={{ stiffness: 200, damping: 20 }}
									>
										{activeNextReviewer.name}
									</TextMorph>
								</span>
								{activeHasBirthday && (
									<span
										className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-md shadow-amber-500/5 motion-safe:animate-pulse dark:text-amber-300"
										title="¡Feliz Cumpleaños! 🎂"
									>
										🎂 HBD!
									</span>
								)}
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
							{upcomingReviewer && (
								<div className="flex flex-col items-center gap-0.5 sm:mt-1 sm:gap-1">
									<span
										className="h-3 w-px bg-border sm:h-5"
										aria-hidden="true"
									/>
									<span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:text-xs">
										{t("pr.upNext")}
									</span>
									<h4 className="inline-flex items-center justify-center gap-1.5 text-lg font-medium text-foreground lg:text-xl">
										<TextMorph ease={{ stiffness: 200, damping: 20 }}>
											{upcomingReviewer.name}
										</TextMorph>
										{upcomingHasBirthday && (
											<Badge variant="secondary">🎂 HBD</Badge>
										)}
									</h4>
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
			</div>
		</div>
	);
}
