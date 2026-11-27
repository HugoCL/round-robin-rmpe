"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "@/convex/_generated/dataModel";
import { useConvexTags } from "@/hooks/useConvexTags";
import { countRegularAssignmentsUntilReviewer } from "@/lib/assignmentResolver";
import { getInitials } from "@/lib/initials";
import { isEligibleForAssignment } from "@/lib/reviewerEligibility";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rotationQueue } from "../assignment/assignmentCard.utils";
import { describeReturn } from "../describeReturn";
import { usePRReview } from "../PRReviewContext";
import { WidgetEmpty, widgetRowClass } from "./parts";
import { WidgetFrame } from "./WidgetFrame";

const GENERAL = "general";

/**
 * Who the rotation picks next, the rest by fewest PRs received, then whoever
 * is out of it. Only the first place is a promise: the rotation goes by count,
 * so the same person can be picked again before the second in the list.
 */
export function RotationWidget() {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug, reviewers, userInfo, teamTimezone } = usePRReview();
	const { tags } = useConvexTags(teamSlug);
	const [selectedTagId, setSelectedTagId] = useState<Id<"tags">>();
	const tag = tags.find((item) => item._id === selectedTagId);
	const tagId = tag?._id;

	const listed = tagId
		? reviewers.filter((reviewer) => reviewer.tags?.includes(tagId))
		: reviewers;
	const queue = rotationQueue(
		listed.filter((reviewer) => isEligibleForAssignment(reviewer, tagId)),
		[],
	);
	const queueIds = new Set(queue.map((reviewer) => String(reviewer._id)));
	const out = listed.filter((reviewer) => !queueIds.has(String(reviewer._id)));

	const myEmail = userInfo?.email?.toLowerCase();
	const isMe = (reviewer: Reviewer) =>
		!!myEmail && reviewer.email.toLowerCase() === myEmail;
	// The count rotation is not a plain queue, so "in N PRs" comes from the
	// resolver, and only for the general rotation it models.
	const me = tagId ? undefined : queue.find(isMe);
	const prsUntilMe = me
		? countRegularAssignmentsUntilReviewer(reviewers, me._id)
		: null;

	const whyOut = (reviewer: Reviewer) => {
		if (reviewer.absenceReason === "part_time_schedule")
			return t("partTime.scheduleReason");
		if (reviewer.absenceReason === "manual")
			return reviewer.absentUntil
				? describeReturn(t, locale, teamTimezone, reviewer.absentUntil)
				: t("partTime.noReturnDate");
		return reviewer.excludedFromReviewPool === true
			? t("reviewer.outOfReviewPoolBadge")
			: null;
	};

	const row = (reviewer: Reviewer, place: "next" | "in" | "out") => (
		<li
			key={reviewer._id}
			className={cn(widgetRowClass, place === "out" && "text-muted-foreground")}
		>
			<Avatar size="sm">
				<AvatarFallback>{getInitials(reviewer.name)}</AvatarFallback>
			</Avatar>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1.5">
					<span className="truncate">{reviewer.name}</span>
					{isMe(reviewer) ? (
						<span className="shrink-0 rounded-full bg-primary/12 px-1.5 text-xs font-medium text-primary">
							{t("widgets.rotation.you")}
						</span>
					) : null}
				</span>
				{place === "out" && whyOut(reviewer) ? (
					<span className="block truncate text-xs text-muted-foreground">
						{whyOut(reviewer)}
					</span>
				) : null}
			</span>
			{place === "next" ? (
				<span className="shrink-0 text-xs font-medium text-primary">
					{t(
						isMe(reviewer)
							? "widgets.rotation.nextYou"
							: "widgets.rotation.next",
					)}
				</span>
			) : reviewer._id === me?._id && prsUntilMe ? (
				<span className="shrink-0 text-xs font-medium text-primary">
					{t("widgets.rotation.inPrs", { count: prsUntilMe })}
				</span>
			) : (
				<span
					className="shrink-0 text-xs text-muted-foreground tabular-nums"
					title={t("widgets.rotation.countHint", {
						count: reviewer.assignmentCount,
					})}
				>
					{reviewer.assignmentCount}
				</span>
			)}
		</li>
	);

	return (
		<WidgetFrame
			meta={
				listed.length > 0
					? t("widgets.rotation.available", {
							available: queue.length,
							total: listed.length,
						})
					: undefined
			}
			actions={
				tags.length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size="sm"
									className="-mr-2 rounded-full text-muted-foreground"
								/>
							}
						>
							{tag ? (
								<span
									className="size-2 rounded-full"
									style={{ backgroundColor: tag.color }}
									aria-hidden="true"
								/>
							) : null}
							{tag?.name ?? t("pr.assignmentModeRegularShort")}
							<ChevronDown data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							<DropdownMenuRadioGroup
								value={tagId ?? GENERAL}
								onValueChange={(value) =>
									setSelectedTagId(
										value === GENERAL ? undefined : (value as Id<"tags">),
									)
								}
							>
								<DropdownMenuRadioItem value={GENERAL}>
									{t("pr.assignmentModeRegularShort")}
								</DropdownMenuRadioItem>
								{tags.map((item) => (
									<DropdownMenuRadioItem key={item._id} value={item._id}>
										<span
											className="size-2 rounded-full"
											style={{ backgroundColor: item.color }}
											aria-hidden="true"
										/>
										{item.name}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null
			}
		>
			{listed.length === 0 ? (
				<WidgetEmpty>{t("reviewersPanel.emptyDescription")}</WidgetEmpty>
			) : (
				<>
					<ul>
						{queue.map((reviewer, index) =>
							row(reviewer, index === 0 ? "next" : "in"),
						)}
					</ul>
					{out.length > 0 ? (
						<>
							<p className="mt-3 mb-1 text-xs text-muted-foreground">
								{t("reviewersPanel.absentGroup")}
							</p>
							<ul>{out.map((reviewer) => row(reviewer, "out"))}</ul>
						</>
					) : null}
				</>
			)}
		</WidgetFrame>
	);
}
