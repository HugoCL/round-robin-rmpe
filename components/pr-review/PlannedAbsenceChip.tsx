"use client";

import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { WithTooltip } from "@/components/ui/tooltip";
import type { Doc } from "@/convex/_generated/dataModel";
import { countWeekdaysInRange, type DateKeyRange } from "@/lib/plannedAbsences";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDateKeyDay, MarkAbsentDialog } from "./dialogs/MarkAbsentDialog";
import { usePRReview } from "./PRReviewContext";

const PILL_CLASS =
	"inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[11px] font-medium leading-4 text-amber-800 dark:text-amber-300";

function parseKey(key: string) {
	const [year, month, day] = key.split("-").map(Number);
	return { year, date: new Date(Date.UTC(year, month - 1, day)) };
}

/**
 * "19–23 oct" within a month, "28 oct – 3 nov" across months. The year is added
 * only when the range is not inside the current year. Built from date keys in
 * UTC so the browser timezone can never shift a day.
 */
export function formatDateKeyRange(range: DateKeyRange, locale: string) {
	const start = parseKey(range.startDate);
	const end = parseKey(range.endDate);
	const currentYear = new Date().getFullYear();
	const formatter = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		day: "numeric",
		month: "short",
		year:
			start.year === currentYear && end.year === currentYear
				? undefined
				: "numeric",
	});
	return formatter.formatRange(start.date, end.date);
}

interface PlannedAbsenceChipProps {
	absence: Doc<"reviewerAbsences">;
	reviewer: Reviewer;
	variant: "short" | "labeled";
	canEdit: boolean;
}

export function PlannedAbsenceChip({
	absence,
	reviewer,
	variant,
	canEdit,
}: PlannedAbsenceChipProps) {
	const t = useTranslations();
	const locale = useLocale();
	const { userInfo, onMarkAbsent, onCancelAbsence } = usePRReview();
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [isCancelling, setIsCancelling] = useState(false);

	const range = formatDateKeyRange(absence, locale);
	const label =
		variant === "labeled"
			? t("absent.chipLabeled", { range })
			: t("absent.chipShort", { range });
	const detail = t("absent.planPreview", {
		start: formatDateKeyDay(absence.startDate, locale),
		end: formatDateKeyDay(absence.endDate, locale),
		days: countWeekdaysInRange(absence),
	});

	const content = (
		<>
			<CalendarClock className="size-3 shrink-0" aria-hidden="true" />
			<span className="whitespace-nowrap">{label}</span>
		</>
	);

	if (!canEdit) {
		return (
			<WithTooltip label={detail}>
				{/* Focusable so keyboard users can open the tooltip with the full dates. */}
				<span
					role="group"
					tabIndex={0}
					aria-label={`${label}. ${detail}`}
					className={cn(
						PILL_CLASS,
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
				>
					{content}
				</span>
			</WithTooltip>
		);
	}

	const handleCancel = async () => {
		setIsCancelling(true);
		try {
			const ok = await onCancelAbsence(absence._id);
			if (ok) setPopoverOpen(false);
		} finally {
			setIsCancelling(false);
		}
	};

	return (
		<>
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className={cn(
							PILL_CLASS,
							"cursor-pointer transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						)}
						aria-label={`${label}. ${detail}`}
					>
						{content}
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-64 gap-3 p-3">
					<div className="grid gap-0.5">
						<p className="text-sm font-medium">{label}</p>
						<p className="text-xs text-muted-foreground">{detail}</p>
					</div>
					<div className="flex items-center justify-end gap-1.5">
						<Button
							size="xs"
							variant="ghost"
							className="text-destructive"
							onClick={() => void handleCancel()}
							disabled={isCancelling}
						>
							{absence.status === "active"
								? t("absent.endNow")
								: t("absent.cancelPlan")}
						</Button>
						<Button
							size="xs"
							variant="outline"
							onClick={() => {
								setPopoverOpen(false);
								setEditOpen(true);
							}}
							disabled={isCancelling}
						>
							{t("common.edit")}
						</Button>
					</div>
				</PopoverContent>
			</Popover>
			<MarkAbsentDialog
				isOpen={editOpen}
				onOpenChange={setEditOpen}
				reviewer={reviewer}
				currentUser={userInfo}
				absence={absence}
				onMarkAbsent={async (absentUntil) => {
					await onMarkAbsent(reviewer._id, absentUntil);
				}}
			/>
		</>
	);
}
