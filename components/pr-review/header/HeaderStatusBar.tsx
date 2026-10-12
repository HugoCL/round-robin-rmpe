"use client";

import { useQuery } from "convex/react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { PlannedAbsenceChip } from "@/components/pr-review/PlannedAbsenceChip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { useTeamWeeklyPrCount } from "@/hooks/useTeamWeeklyPrCount";
import { countRegularAssignmentsUntilReviewer } from "@/lib/assignmentResolver";
import { findNextScheduledAbsence } from "@/lib/plannedAbsences";
import { isIncludedInTagRotations } from "@/lib/reviewerEligibility";
import { cn } from "@/lib/utils";
import { describeReturn } from "../describeReturn";
import { MarkAbsentDialog } from "../dialogs/MarkAbsentDialog";
import { usePRReview } from "../PRReviewContext";

const PILL_CLASS = "h-9 gap-2 rounded-full px-3 text-sm font-normal";

function getPrNumber(prUrl?: string | null) {
	return prUrl?.match(/(?:pull|pulls|merge_requests)\/(\d+)(?:[/?#]|$)/i)?.[1];
}

function isHttpUrl(value?: string | null) {
	return Boolean(value && /^https?:\/\//i.test(value));
}

function formatAssignedWhen(timestamp: number, locale: string) {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	}).format(timestamp);
}

function LastPrRow({
	label,
	pr,
	locale,
}: {
	label: string;
	pr: { prUrl: string | null; timestamp: number } | null | undefined;
	locale: string;
}) {
	const number = getPrNumber(pr?.prUrl);
	const text = number ? `#${number}` : "–";

	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="flex flex-col items-end gap-0.5 tabular-nums">
				{pr && isHttpUrl(pr.prUrl) ? (
					<a
						href={pr.prUrl ?? undefined}
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium underline-offset-4 hover:underline"
					>
						{text}
					</a>
				) : (
					<span className="font-medium">{text}</span>
				)}
				{pr ? (
					<span className="text-xs text-muted-foreground">
						{formatAssignedWhen(pr.timestamp, locale)}
					</span>
				) : null}
			</dd>
		</>
	);
}

/**
 * The person's own state as two compact pills: availability (with the turn
 * count) and the week's numbers. Details and controls open on demand.
 */
/** The popover is narrow: long labels wrap inside the box instead of overflowing it. */
const WRAPPING_BUTTON = "h-auto min-h-8 max-w-full whitespace-normal py-1.5";

export function HeaderStatusBar() {
	const t = useTranslations();
	const locale = useLocale();
	const {
		teamSlug,
		userInfo,
		reviewers,
		nextReviewer,
		canManageCurrentTeam,
		isForeignTeamView,
		onMarkAbsent,
		onMarkAvailable,
		onSetExcludedFromReviewPool,
		plannedAbsences,
		teamTimezone,
	} = usePRReview();
	const [now] = useState(() => Date.now());
	const [statusOpen, setStatusOpen] = useState(false);
	const [absentDialogOpen, setAbsentDialogOpen] = useState(false);
	const { count: teamWeeklyCount } = useTeamWeeklyPrCount(teamSlug);

	const stats = useQuery(
		api.queries.getMyWeeklyAssignmentStats,
		teamSlug ? { teamSlug, now } : "skip",
	);

	const currentReviewer = useMemo(() => {
		const email = userInfo?.email?.toLowerCase();
		if (!email) return null;
		return (
			reviewers.find((reviewer) => reviewer.email.toLowerCase() === email) ??
			null
		);
	}, [reviewers, userInfo?.email]);

	const isNext = Boolean(
		currentReviewer && nextReviewer?._id === currentReviewer._id,
	);
	const canToggleAvailability = Boolean(
		currentReviewer && canManageCurrentTeam && !isForeignTeamView,
	);
	const isAbsent = currentReviewer?.manualIsAbsent === true;
	const outOfPool = currentReviewer?.excludedFromReviewPool === true;
	const scheduledAbsence = currentReviewer
		? findNextScheduledAbsence(plannedAbsences, currentReviewer._id)
		: null;
	const prsUntilTurn = useMemo(() => {
		if (!currentReviewer) return null;
		return countRegularAssignmentsUntilReviewer(reviewers, currentReviewer._id);
	}, [currentReviewer, reviewers]);
	const returningLabel =
		currentReviewer?.manualIsAbsent && currentReviewer.absentUntil
			? describeReturn(t, locale, teamTimezone, currentReviewer.absentUntil)
			: currentReviewer?.manualIsAbsent
				? t("partTime.noReturnDate")
				: null;

	const statusLabel = isAbsent
		? t("headerStatus.unavailable")
		: outOfPool
			? t("reviewer.outOfReviewPoolBadge")
			: t("headerStatus.available");
	const turnLabel =
		isAbsent || outOfPool
			? null
			: isNext
				? t("headerStatus.youAreNext")
				: prsUntilTurn
					? t("headerStatus.untilTurn", { count: prsUntilTurn })
					: null;
	// Absent with no return date: the team cannot plan around it, so the
	// popover offers the two ways out.
	const needsAbsenceDecision = Boolean(
		currentReviewer &&
			canToggleAvailability &&
			currentReviewer.isAbsent &&
			currentReviewer.absentUntil == null &&
			!(outOfPool && !isIncludedInTagRotations(currentReviewer)),
	);
	const statusNotes = [
		returningLabel,
		currentReviewer?.isOffTodayBySchedule && !isAbsent
			? t("headerStatus.partTimeOff")
			: null,
	].filter((note): note is string => Boolean(note));

	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			{currentReviewer ? (
				<Popover open={statusOpen} onOpenChange={setStatusOpen}>
					<PopoverTrigger asChild>
						{/* Your status reads as text, not as one more bordered control. On
						    its own phone row it starts at the page edge, like the name above. */}
						<Button
							variant="ghost"
							size="sm"
							className={cn(PILL_CLASS, "hover:bg-muted/40 max-sm:-ml-3")}
						>
							<span
								aria-hidden="true"
								className={cn(
									"size-2 shrink-0 rounded-full",
									isAbsent
										? "bg-amber-500"
										: outOfPool
											? "bg-muted-foreground"
											: "bg-emerald-500",
								)}
							/>
							<span>{statusLabel}</span>
							{turnLabel ? (
								<span className="text-muted-foreground">· {turnLabel}</span>
							) : null}
							<ChevronDown
								className="size-4 text-muted-foreground"
								aria-hidden="true"
							/>
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="gap-3">
						<p className="font-medium">{currentReviewer.name}</p>
						{canToggleAvailability ? (
							<div className="flex items-center justify-between gap-3">
								<Label htmlFor="header-availability" className="cursor-pointer">
									{t("reviewer.availabilitySwitchLabel")}
								</Label>
								<Switch
									id="header-availability"
									checked={!isAbsent}
									onCheckedChange={(checked) => {
										if (!checked) {
											setStatusOpen(false);
											setAbsentDialogOpen(true);
											return;
										}
										void onMarkAvailable(currentReviewer._id);
									}}
								/>
							</div>
						) : null}
						{statusNotes.map((note) => (
							<p key={note} className="text-xs text-muted-foreground">
								{note}
							</p>
						))}
						{needsAbsenceDecision && currentReviewer ? (
							<div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
								<p className="text-xs text-foreground">
									{t("absent.indefiniteReminderTitle")}
								</p>
								<div className="flex flex-wrap gap-1.5">
									<Button
										type="button"
										size="sm"
										className={WRAPPING_BUTTON}
										onClick={() => void onMarkAvailable(currentReviewer._id)}
									>
										{t("absent.markAvailableCta")}
									</Button>
									{!outOfPool ? (
										<Button
											type="button"
											size="sm"
											variant="outline"
											className={WRAPPING_BUTTON}
											onClick={() =>
												void onSetExcludedFromReviewPool(
													currentReviewer._id,
													true,
												)
											}
										>
											{t("absent.notAReviewerCta")}
										</Button>
									) : null}
								</div>
							</div>
						) : null}
						{scheduledAbsence ? (
							<PlannedAbsenceChip
								absence={scheduledAbsence}
								reviewer={currentReviewer}
								variant="labeled"
								canEdit={canToggleAvailability}
							/>
						) : null}
						{canToggleAvailability ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="self-start"
								onClick={() => {
									setStatusOpen(false);
									setAbsentDialogOpen(true);
								}}
							>
								{t("absent.planCta")}
							</Button>
						) : null}
					</PopoverContent>
				</Popover>
			) : null}

			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						aria-label={t("headerStatus.myWeek")}
						className={cn(
							PILL_CLASS,
							"border-border/70 bg-transparent max-sm:size-9 max-sm:px-0",
						)}
					>
						<CalendarDays
							className="size-4 text-muted-foreground"
							aria-hidden="true"
						/>
						<span className="max-sm:sr-only">{t("headerStatus.myWeek")}</span>
						<ChevronDown
							className="size-4 text-muted-foreground max-sm:hidden"
							aria-hidden="true"
						/>
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="gap-3">
					<p className="font-medium">{t("headerStatus.thisWeek")}</p>
					<dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2.5">
						<dt className="text-muted-foreground">
							{t("headerStatus.receivedLabel")}
						</dt>
						<dd className="text-right font-medium tabular-nums">
							{stats?.received ?? "–"}
						</dd>
						<dt className="text-muted-foreground">
							{t("headerStatus.sentLabel")}
						</dt>
						<dd className="text-right font-medium tabular-nums">
							{stats?.sent ?? "–"}
						</dd>
						{currentReviewer ? (
							<>
								<LastPrRow
									label={t("headerStatus.lastReceived")}
									pr={stats?.lastReceived}
									locale={locale}
								/>
								<LastPrRow
									label={t("headerStatus.lastSent")}
									pr={stats?.lastSent}
									locale={locale}
								/>
							</>
						) : null}
						<dt className="text-muted-foreground">
							{t("headerStatus.teamTotal")}
						</dt>
						<dd className="text-right font-medium tabular-nums">
							{new Intl.NumberFormat(locale).format(teamWeeklyCount)}
						</dd>
					</dl>
				</PopoverContent>
			</Popover>

			{currentReviewer ? (
				<MarkAbsentDialog
					isOpen={absentDialogOpen}
					onOpenChange={setAbsentDialogOpen}
					reviewer={currentReviewer}
					currentUser={userInfo}
					onMarkAbsent={async (absentUntil) => {
						await onMarkAbsent(currentReviewer._id, absentUntil);
					}}
				/>
			) : null}
		</div>
	);
}
