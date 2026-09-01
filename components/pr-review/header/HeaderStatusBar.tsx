"use client";

import { useQuery } from "convex/react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { KeyboardShortcutsHelp } from "@/components/pr-review/KeyboardShortcutsHelp";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { countRegularAssignmentsUntilReviewer } from "@/lib/assignmentResolver";
import { cn } from "@/lib/utils";
import { MarkAbsentDialog } from "../dialogs/MarkAbsentDialog";
import { usePRReview } from "../PRReviewContext";

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

function LastPrStat({
	label,
	hoverLabel,
	pr,
	icon: Icon,
}: {
	label: string;
	hoverLabel: string;
	pr: { prUrl: string | null; timestamp: number } | null | undefined;
	icon: typeof ArrowDownLeft;
}) {
	const number = getPrNumber(pr?.prUrl);
	const text = number ? `#${number}` : "–";
	const href = isHttpUrl(pr?.prUrl) ? pr?.prUrl : null;
	const tooltip = pr ? hoverLabel : label;
	const ariaLabel = pr ? `${label}: ${text}. ${hoverLabel}` : label;

	const content = (
		<span className="inline-flex h-3.5 items-center gap-1 leading-none tabular-nums">
			<Icon className="size-3.5 shrink-0" aria-hidden="true" />
			<span
				className={cn(
					"font-medium",
					number ? "text-foreground" : "text-muted-foreground",
				)}
			>
				{text}
			</span>
		</span>
	);

	return (
		<WithTooltip label={tooltip} className="h-3.5 items-center leading-none">
			{href ? (
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex h-3.5 items-center rounded-sm hover:underline"
					aria-label={ariaLabel}
				>
					{content}
				</a>
			) : (
				<span className="inline-flex h-3.5 items-center" aria-label={ariaLabel}>
					{content}
				</span>
			)}
		</WithTooltip>
	);
}

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
	} = usePRReview();
	const [now] = useState(() => Date.now());
	const [absentDialogOpen, setAbsentDialogOpen] = useState(false);

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
	const outOfPool = currentReviewer?.excludedFromReviewPool === true;
	const prsUntilTurn = useMemo(() => {
		if (!currentReviewer) return null;
		return countRegularAssignmentsUntilReviewer(reviewers, currentReviewer._id);
	}, [currentReviewer, reviewers]);
	const returningLabel =
		currentReviewer?.manualIsAbsent && currentReviewer.absentUntil
			? t("partTime.returningOn", {
					date: new Date(currentReviewer.absentUntil).toLocaleDateString(
						locale,
					),
				})
			: currentReviewer?.manualIsAbsent
				? t("partTime.noReturnDate")
				: null;

	return (
		<div className="flex min-h-11 flex-wrap items-stretch gap-x-3 gap-y-2 rounded-b-2xl border border-t-0 border-border/60 bg-muted/28 px-3 py-1.5 backdrop-blur-sm">
			{currentReviewer ? (
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="truncate text-sm font-medium">
						{currentReviewer.name}
					</span>
					{canToggleAvailability ? (
						<WithTooltip label={t("reviewer.availabilitySwitchLabel")}>
							<Switch
								size="sm"
								checked={!currentReviewer.manualIsAbsent}
								aria-label={t("reviewer.availabilitySwitchLabel")}
								onCheckedChange={(checked) => {
									if (!checked) {
										setAbsentDialogOpen(true);
										return;
									}
									void onMarkAvailable(currentReviewer._id);
								}}
							/>
						</WithTooltip>
					) : null}
					<span className="text-xs text-muted-foreground">
						{currentReviewer.manualIsAbsent
							? t("headerStatus.unavailable")
							: t("headerStatus.available")}
					</span>
					{returningLabel ? (
						<span className="text-xs text-muted-foreground">
							{returningLabel}
						</span>
					) : null}
					{currentReviewer.isOffTodayBySchedule &&
					!currentReviewer.manualIsAbsent ? (
						<span className="text-xs text-muted-foreground">
							{t("headerStatus.partTimeOff")}
						</span>
					) : null}
					{outOfPool ? (
						<Badge variant="outline" className="h-6 text-xs">
							{t("reviewer.outOfReviewPoolBadge")}
						</Badge>
					) : null}
					{isNext ? (
						<Badge
							variant="outline"
							className="h-6 border-primary/25 bg-primary/10 text-xs text-primary"
						>
							{t("headerStatus.youAreNext")}
						</Badge>
					) : null}
				</div>
			) : null}

			{currentReviewer ? (
				<Separator
					orientation="vertical"
					className="my-1 hidden self-stretch sm:block"
				/>
			) : null}

			<div
				className="flex h-3.5 shrink-0 flex-nowrap items-center gap-x-3 self-center text-xs leading-none text-muted-foreground"
				aria-label={t("headerStatus.thisWeek")}
			>
				<span className="font-medium text-foreground">
					{t("headerStatus.thisWeek")}
				</span>
				<span
					className="inline-flex h-3.5 items-center gap-1 tabular-nums"
					aria-label={t("headerStatus.receivedAria", {
						count: stats?.received ?? 0,
					})}
				>
					<ArrowDownLeft className="size-3.5 shrink-0" aria-hidden="true" />
					<span
						className={cn(
							"font-medium",
							stats ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{stats?.received ?? "–"}
					</span>
					{t("headerStatus.received")}
				</span>
				<span
					className="inline-flex h-3.5 items-center gap-1 tabular-nums"
					aria-label={t("headerStatus.sentAria", {
						count: stats?.sent ?? 0,
					})}
				>
					<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
					<span
						className={cn(
							"font-medium",
							stats ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{stats?.sent ?? "–"}
					</span>
					{t("headerStatus.sent")}
				</span>
			</div>

			{currentReviewer ? (
				<>
					<Separator
						orientation="vertical"
						className="my-1 hidden self-stretch sm:block"
					/>
					<div className="flex h-3.5 shrink-0 flex-nowrap items-center gap-x-3 self-center whitespace-nowrap text-xs leading-none text-muted-foreground">
						<span className="inline-flex h-3.5 items-center font-medium text-foreground">
							{t("headerStatus.lastPrs")}
						</span>
						<div className="flex h-3.5 items-center gap-x-3">
							<LastPrStat
								label={t("headerStatus.lastReceived")}
								hoverLabel={
									stats?.lastReceived
										? t("headerStatus.lastReceivedHover", {
												when: formatAssignedWhen(
													stats.lastReceived.timestamp,
													locale,
												),
											})
										: t("headerStatus.lastReceived")
								}
								pr={stats?.lastReceived}
								icon={ArrowDownLeft}
							/>
							<LastPrStat
								label={t("headerStatus.lastSent")}
								hoverLabel={
									stats?.lastSent
										? t("headerStatus.lastSentHover", {
												when: formatAssignedWhen(
													stats.lastSent.timestamp,
													locale,
												),
											})
										: t("headerStatus.lastSent")
								}
								pr={stats?.lastSent}
								icon={ArrowUpRight}
							/>
						</div>
						{prsUntilTurn !== null && prsUntilTurn > 0 ? (
							<WithTooltip
								label={t("headerStatus.untilTurnTooltip")}
								className="h-3.5 items-center"
							>
								<span className="inline-flex h-3.5 items-center text-foreground">
									{t("headerStatus.untilTurn", { count: prsUntilTurn })}
								</span>
							</WithTooltip>
						) : null}
					</div>
				</>
			) : null}

			<div className="ml-auto hidden items-center md:flex">
				<KeyboardShortcutsHelp iconOnly />
			</div>

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
