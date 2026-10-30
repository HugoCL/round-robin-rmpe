import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { FORCE_ASSIGN_TRIGGER_ID } from "@/lib/assignmentFocus";
import { reviewerHasBirthdayToday } from "@/lib/reviewerAvailability";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	useReviewersPanel,
	ViewReviewersLink,
} from "../layouts/ReviewersPanelContext";
import { usePRReview } from "../PRReviewContext";
import type { AssignmentMode } from "./assignmentCard.types";

type AssignmentHeroPanelProps = {
	mode: AssignmentMode;
	isAssigning: boolean;
	activeNextReviewer: Reviewer | null;
	/** The viewer's reviewer on this team: the one assigning skips. */
	currentUserReviewerId?: string;
	upcomingReviewer: Reviewer | null;
	/** Who follows the receiver in the rotation. */
	upcomingAfterReceiver: Reviewer | null;
	/** With multiple assignment on, everyone who gets the PR, in order. */
	multipleReceivers: Reviewer[] | null;
	/**
	 * Across teams, the team of each reviewer who is not on this one, for the
	 * line under several names; with one, the rotation chip already names it.
	 */
	otherTeamNameByReviewerId?: Map<string, string>;
	isLoadingTagReviewer: boolean;
	/** Picks the rotation the name comes from; sits on the name's line. */
	rotationMenu?: ReactNode;
	/** Opens the force-assign dialog; the link sits last on the line under the name. */
	onPickSomeoneElse?: () => void;
};

/** From this many people on, first names only, so they still fit. */
const SHORT_NAMES_FROM = 2;

export function AssignmentHeroPanel({
	mode,
	isAssigning,
	activeNextReviewer,
	currentUserReviewerId,
	upcomingReviewer,
	upcomingAfterReceiver,
	multipleReceivers,
	otherTeamNameByReviewerId,
	isLoadingTagReviewer,
	rotationMenu,
	onPickSomeoneElse,
}: AssignmentHeroPanelProps) {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug } = usePRReview();
	const reviewersPanel = useReviewersPanel();

	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");
	const teamTimezone = team?.timezone ?? "UTC";

	const isSelfNext =
		!!currentUserReviewerId &&
		activeNextReviewer?._id === currentUserReviewerId;
	// Assigning skips the person looking when they are next, so the hero names
	// who actually receives the PR (the resolver's pick once they are excluded).
	const receiver = isSelfNext ? upcomingReviewer : activeNextReviewer;
	const isMultiple = (multipleReceivers?.length ?? 0) > 1;
	// With several people getting the PR there is no single "next after".
	const following = isMultiple ? null : upcomingAfterReceiver;
	const followingHasBirthday =
		following && reviewerHasBirthdayToday(following, teamTimezone);
	// Everyone who gets the PR shares the big line, at equal weight. The size
	// steps down with the count and the line height stays fixed, so the row
	// never grows and the rotation chip never drops below it.
	const receivers: Reviewer[] =
		multipleReceivers && isMultiple
			? multipleReceivers
			: receiver
				? [receiver]
				: [];
	const shortNames = receivers.length >= SHORT_NAMES_FROM;
	const receiverNames = receivers.map((item) =>
		shortNames ? item.name.split(/\s+/)[0] : item.name,
	);
	const listFormat = new Intl.ListFormat(locale, { type: "conjunction" });
	const receiverLabel = listFormat.format(receiverNames);
	// Parts keep the input order, so the n-th name is the n-th receiver: keyed by
	// id, two people sharing a first name stay distinct.
	let namesSeen = 0;
	const receiverParts = listFormat.formatToParts(receiverNames).map((part) => {
		if (part.type === "element") namesSeen += 1;
		const ownerId = receivers[namesSeen - 1]?._id;
		return {
			...part,
			key: part.type === "element" ? ownerId : `after-${ownerId}`,
		};
	});
	const receiverSizeClass =
		receivers.length >= 4
			? "text-lg lg:text-xl"
			: receivers.length === 3
				? "text-xl lg:text-2xl"
				: receivers.length === 2
					? "text-2xl lg:text-3xl"
					: "text-3xl lg:text-4xl";

	const receiverHasBirthday =
		receiver && reviewerHasBirthdayToday(receiver, teamTimezone);
	// Several people across teams: one group per team, in the order they come,
	// e.g. "Catalina y Joaquín, de tu equipo · Sofía, de Demo Pagos".
	const receiversByTeam = new Map<string, string[]>();
	if (otherTeamNameByReviewerId && isMultiple) {
		for (const [index, item] of receivers.entries()) {
			const team =
				otherTeamNameByReviewerId.get(String(item._id)) ??
				t("googleChat.crossTeamOwnTeam");
			receiversByTeam.set(team, [
				...(receiversByTeam.get(team) ?? []),
				receiverNames[index],
			]);
		}
	}

	const emptyTitle = isSelfNext
		? t("pr.noAvailableReviewersTitle")
		: mode === "tag"
			? isLoadingTagReviewer
				? t("tags.findingNextReviewer")
				: t("tags.noAvailableReviewers")
			: t("pr.noAvailableReviewersTitle");
	const emptyHint = isSelfNext
		? t("pr.autoSkipDescriptionNoNext")
		: mode === "tag"
			? null
			: t("pr.allReviewersAbsent");

	// What closes the line, so each item before it knows whether to add a "·".
	const hasTail = !!reviewersPanel || !!onPickSomeoneElse;

	return (
		<div className="flex flex-col gap-2">
			{/* From sm, no wrap: a long name yields width instead of pushing the chip
			    down. On phones the chip gets its own line above, or the name has ~100px. */}
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4">
				{receiver ? (
					<h2
						className={cn(
							"flex min-h-10 min-w-0 flex-1 items-baseline gap-x-2 transition-opacity duration-200 motion-reduce:transition-none",
							isAssigning ? "opacity-40" : "opacity-100",
						)}
					>
						<span className="shrink-0 text-sm font-normal tracking-normal text-muted-foreground lg:text-base">
							{t("pr.nextReviewer")}
						</span>
						<span
							className={cn(
								"min-w-0 truncate font-semibold text-primary",
								receiverSizeClass,
							)}
							title={receiverLabel}
						>
							{/* Keyed fade per person, not a glyph morph: the morph lays letters
							    out absolutely and a long name overflowed while it ran. */}
							{receiverParts.map((part) =>
								part.type === "element" ? (
									<span
										key={part.key}
										className="inline-block animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
									>
										{part.value}
									</span>
								) : (
									<span
										key={part.key}
										className="font-normal text-muted-foreground"
									>
										{part.value}
									</span>
								),
							)}
						</span>
						{receiverHasBirthday && (
							<Badge variant="secondary" title="¡Feliz Cumpleaños! 🎂">
								🎂 HBD
							</Badge>
						)}
					</h2>
				) : (
					<div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center gap-1">
						{/* min-h: as tall as the name line, so an empty state does not shift the card. */}
						<h2 className="text-lg font-medium">{emptyTitle}</h2>
						{emptyHint ? (
							<p className="text-sm text-muted-foreground">{emptyHint}</p>
						) : null}
					</div>
				)}
				<div className="shrink-0">{rotationMenu}</div>
			</div>
			{/* Also with nobody to assign: that is when the panel is needed most,
			    e.g. a new team whose only reviewer is its creator. */}
			{receiver || hasTail ? (
				<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground lg:text-base">
					{receiver && isSelfNext && (
						<>
							<span>{t("pr.autoSkipNote")}</span>
							{receiversByTeam.size > 0 || following || hasTail ? (
								<span aria-hidden="true">·</span>
							) : null}
						</>
					)}
					{[...receiversByTeam].map(([team, names], index, groups) => (
						<span key={team} className="contents">
							<span>
								{t("pr.receiversFromTeam", {
									names: listFormat.format(names),
									team,
								})}
							</span>
							{index < groups.length - 1 || hasTail ? (
								<span aria-hidden="true">·</span>
							) : null}
						</span>
					))}
					{following && (
						<>
							<span>
								{t("pr.upNext")}{" "}
								<span className="font-medium text-foreground">
									<span
										key={following._id}
										className="inline-block animate-in fade-in-0 duration-200 motion-reduce:animate-none"
									>
										{following.name}
									</span>
								</span>
								{followingHasBirthday && (
									<Badge variant="secondary" className="ml-1.5">
										🎂 HBD
									</Badge>
								)}
							</span>
							{hasTail ? <span aria-hidden="true">·</span> : null}
						</>
					)}
					<ViewReviewersLink />
					{reviewersPanel && onPickSomeoneElse ? (
						<span aria-hidden="true">·</span>
					) : null}
					{onPickSomeoneElse ? (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										id={FORCE_ASSIGN_TRIGGER_ID}
										type="button"
										variant="link"
										disabled={isAssigning}
										onClick={onPickSomeoneElse}
										className="h-auto p-0 text-sm text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground lg:text-base"
									>
										{t("pr.forceAssignLink")}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p className="flex items-center gap-2">
										{t("pr.forceAssignLinkHint")}
										<Kbd>F</Kbd>
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					) : null}
				</p>
			) : null}
		</div>
	);
}
