"use client";

import type { DateRange } from "@daypicker/react";
import { format, parse } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Doc } from "@/convex/_generated/dataModel";
import {
	type AbsenceSubmitErrorCode,
	absenceCoversDay,
	addDaysToDateKey,
	compareDateKeys,
	countWeekdaysInRange,
	type DateKeyRange,
	getAbsenceReturnAt,
	getTodayDateKey,
	resolveAbsenceSubmit,
	validateAbsenceRange,
} from "@/lib/plannedAbsences";
import type { UserInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePRReview } from "../PRReviewContext";

const DATE_KEY_FORMAT = "yyyy-MM-dd";

type PlanValidationError = NonNullable<ReturnType<typeof validateAbsenceRange>>;
type FormError = PlanValidationError | AbsenceSubmitErrorCode;

/** Extra options offered when the range starts today. */
type ReturnOption = "none" | "indefinite" | "today";

/** `lun, 19 oct` for a date key, with the year only outside the current one. */
export function formatDateKeyDay(key: string, locale: string): string {
	const [year, month, day] = key.split("-").map(Number);
	return new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		weekday: "short",
		day: "numeric",
		month: "short",
		year: year === new Date().getFullYear() ? undefined : "numeric",
	}).format(new Date(Date.UTC(year, month - 1, day)));
}

function dateKeyToCalendarDate(key: string): Date {
	return parse(key, DATE_KEY_FORMAT, new Date());
}

interface MarkAbsentDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	reviewer: Doc<"reviewers">;
	currentUser: UserInfo | null;
	onMarkAbsent: (absentUntil?: number) => Promise<void>;
	/** Pre-selected dates. Defaults to today only. */
	initialRange?: DateKeyRange;
	/** Edit mode: the planned absence being changed. */
	absence?: Doc<"reviewerAbsences">;
}

export function MarkAbsentDialog({
	isOpen,
	onOpenChange,
	...bodyProps
}: MarkAbsentDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			{/* The content unmounts on close, so every open starts from fresh state. */}
			<DialogContent className="sm:max-w-[425px]">
				<MarkAbsentDialogBody onOpenChange={onOpenChange} {...bodyProps} />
			</DialogContent>
		</Dialog>
	);
}

function MarkAbsentDialogBody({
	onOpenChange,
	reviewer,
	currentUser,
	onMarkAbsent,
	initialRange,
	absence,
}: Omit<MarkAbsentDialogProps, "isOpen">) {
	const t = useTranslations();
	const locale = useLocale();
	const {
		plannedAbsences,
		teamTimezone,
		onScheduleAbsence,
		onUpdateAbsence,
		onCancelAbsence,
	} = usePRReview();
	const isEdit = absence !== undefined;
	const isActiveEdit = absence?.status === "active";
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	// Keeps "that time already passed" honest while the dialog stays open.
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(id);
	}, []);
	const todayKey = getTodayDateKey(now, teamTimezone);
	const [range, setRange] = useState<DateRange | undefined>(() => {
		const initial = absence ??
			initialRange ?? {
				startDate: todayKey,
				endDate: todayKey,
			};
		return {
			from: dateKeyToCalendarDate(initial.startDate),
			to: dateKeyToCalendarDate(initial.endDate),
		};
	});
	const [returnOption, setReturnOption] = useState<ReturnOption>("none");
	const [returnTime, setReturnTime] = useState("");

	const timeId = useId();
	const dateLocale = locale.startsWith("es") ? es : enUS;

	// Check if current user is marking themselves as absent
	const isSelf =
		currentUser?.email?.toLowerCase() === reviewer.email.toLowerCase();

	// Generate greeting message
	const getGreeting = () => {
		if (isSelf) {
			const firstName = currentUser?.firstName || reviewer.name.split(" ")[0];
			return t("absent.greetingSelf", { name: firstName });
		}
		return t("absent.greetingOther", { name: reviewer.name });
	};

	// Kept as a stable reference so the memo below does not rerun every render.
	const otherRanges = useMemo(
		() =>
			plannedAbsences
				.filter(
					(other) =>
						other.reviewerId === reviewer._id &&
						other._id !== absence?._id &&
						(other.status === "scheduled" || other.status === "active"),
				)
				.map((other) => ({
					startDate: other.startDate,
					endDate: other.endDate,
				})),
		[plannedAbsences, reviewer._id, absence?._id],
	);
	const keyRange: DateKeyRange | null = range?.from
		? {
				startDate: format(range.from, DATE_KEY_FORMAT),
				endDate: format(range.to ?? range.from, DATE_KEY_FORMAT),
			}
		: null;
	const validatePlan = (
		candidate: DateKeyRange,
		today: string,
	): PlanValidationError | null =>
		isActiveEdit
			? // The start already passed: only the end can change, and it can't be
				// earlier than today.
				(validateAbsenceRange({
					range: candidate,
					todayKey: candidate.startDate,
					existing: otherRanges,
				}) ??
				(compareDateKeys(candidate.endDate, today) < 0 ? "startInPast" : null))
			: validateAbsenceRange({
					range: candidate,
					todayKey: today,
					existing: otherRanges,
				});

	// The extra options only make sense for an absence that starts right now.
	const startsToday = keyRange?.startDate === todayKey;
	const showOptions = !isEdit && startsToday;
	const activeOption: ReturnOption = showOptions ? returnOption : "none";
	const isIndefinite = activeOption === "indefinite";
	const returnsToday = activeOption === "today";

	const renderError = keyRange ? validatePlan(keyRange, todayKey) : null;
	// Set when a submit-time check (against the real "today" and clock) fails.
	const [submitError, setSubmitError] = useState<FormError | null>(null);
	const resolution =
		keyRange && !isEdit
			? resolveAbsenceSubmit({
					range: keyRange,
					todayKey,
					indefinite: isIndefinite,
					returnTodayAt: returnsToday ? returnTime : undefined,
					teamTimezone,
					now,
				})
			: null;
	const optionError = resolution?.kind === "error" ? resolution.code : null;
	// An empty time just keeps the button disabled; no need to scold yet.
	const shownError =
		renderError ??
		submitError ??
		(optionError === "returnTimeMissing" ? null : optionError);
	const canSubmit =
		keyRange !== null &&
		renderError === null &&
		submitError === null &&
		optionError === null;

	const isDayDisabled = (date: Date) => {
		const key = format(date, DATE_KEY_FORMAT);
		if (compareDateKeys(key, todayKey) < 0) return true;
		if (
			isActiveEdit &&
			absence &&
			compareDateKeys(key, absence.startDate) < 0
		) {
			return true;
		}
		return otherRanges.some((other) => absenceCoversDay(other, key));
	};

	const handleSelect = (next: DateRange | undefined, triggerDate: Date) => {
		setSubmitError(null);
		if (isActiveEdit && absence) {
			// The start is locked: whatever day is clicked becomes the new end.
			setRange({
				from: dateKeyToCalendarDate(absence.startDate),
				to: triggerDate,
			});
			return;
		}
		// "Back later today" only fits a single-day range.
		if (
			returnOption === "today" &&
			next?.from &&
			format(next.to ?? next.from, DATE_KEY_FORMAT) !== todayKey
		) {
			setReturnOption("none");
		}
		setRange(next);
	};

	const handleOptionChange = (option: ReturnOption, checked: boolean) => {
		setSubmitError(null);
		if (!checked) {
			setReturnOption("none");
			return;
		}
		setReturnOption(option);
		// Both options describe an absence that starts and, at most, ends today.
		const today = dateKeyToCalendarDate(todayKey);
		setRange({ from: today, to: today });
	};

	const handleSubmit = async () => {
		if (!keyRange || !canSubmit) return;
		// The dialog may have been open across midnight: check against the real
		// team "today" and clock instead of the ones captured on open.
		const currentNow = Date.now();
		const currentTodayKey = getTodayDateKey(currentNow, teamTimezone);
		const failure = validatePlan(keyRange, currentTodayKey);
		if (failure) {
			setSubmitError(failure);
			return;
		}
		setIsSubmitting(true);
		try {
			if (absence) {
				if (await onUpdateAbsence(absence._id, keyRange)) onOpenChange(false);
				return;
			}
			const outcome = resolveAbsenceSubmit({
				range: keyRange,
				todayKey: currentTodayKey,
				indefinite: isIndefinite,
				returnTodayAt: returnsToday ? returnTime : undefined,
				teamTimezone,
				now: currentNow,
			});
			if (outcome.kind === "error") {
				setSubmitError(outcome.code);
				return;
			}
			if (outcome.kind === "now") {
				await onMarkAbsent(outcome.absentUntil);
				onOpenChange(false);
				return;
			}
			if (await onScheduleAbsence(reviewer._id, outcome.range)) {
				onOpenChange(false);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancelPlan = async () => {
		if (!absence) return;
		setIsSubmitting(true);
		try {
			const ok = await onCancelAbsence(absence._id);
			if (ok) onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderPreview = () => {
		if (!keyRange) return null;
		if (isIndefinite) {
			return (
				<>
					<p className="font-medium">
						{isSelf
							? t("absent.previewIndefinite")
							: t("absent.previewIndefiniteOther", { name: reviewer.name })}
					</p>
					<p className="text-muted-foreground">{t("absent.noReturnDateSet")}</p>
				</>
			);
		}
		const summary = (
			<p className="font-medium">
				{t("absent.planPreview", {
					start: formatDateKeyDay(keyRange.startDate, locale),
					end: formatDateKeyDay(keyRange.endDate, locale),
					days: countWeekdaysInRange(keyRange),
				})}
			</p>
		);
		if (returnsToday) {
			return (
				<>
					{summary}
					<p className="text-muted-foreground">
						{returnTime
							? t("absent.returningTodayAt", { time: returnTime })
							: t("absent.returningLaterToday")}
					</p>
				</>
			);
		}
		const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const returnKey = addDaysToDateKey(keyRange.endDate, 1);
		const returnAt = getAbsenceReturnAt(keyRange.endDate, teamTimezone);
		const returnDate = new Intl.DateTimeFormat(locale, {
			timeZone: teamTimezone,
			weekday: "short",
			day: "numeric",
			month: "short",
			year:
				Number(returnKey.slice(0, 4)) === new Date().getFullYear()
					? undefined
					: "numeric",
		}).format(returnAt);
		// Usually 00:00; 01:00 when local midnight falls in a DST gap.
		const returnClock = new Intl.DateTimeFormat(locale, {
			timeZone: teamTimezone,
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).format(returnAt);
		const showTimeZone = teamTimezone !== browserTimeZone;
		let returnText: string;
		if (isSelf) {
			returnText = showTimeZone
				? t("absent.planReturn", {
						date: returnDate,
						time: returnClock,
						timeZone: teamTimezone,
					})
				: t("absent.planReturnLocal", { date: returnDate, time: returnClock });
		} else {
			returnText = showTimeZone
				? t("absent.planReturnOther", {
						name: reviewer.name,
						date: returnDate,
						time: returnClock,
						timeZone: teamTimezone,
					})
				: t("absent.planReturnOtherLocal", {
						name: reviewer.name,
						date: returnDate,
						time: returnClock,
					});
		}
		return (
			<>
				{summary}
				<p className="text-muted-foreground">{returnText}</p>
			</>
		);
	};

	const submitLabel = isEdit
		? t("common.save")
		: startsToday
			? t("absent.markAbsent")
			: t("absent.planSubmit");
	const showTeamTimeZone =
		teamTimezone !== Intl.DateTimeFormat().resolvedOptions().timeZone;
	const indefiniteId = `${timeId}-indefinite`;
	const todayId = `${timeId}-today`;

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{isEdit ? t("absent.editTitle") : t("absent.markAbsentTitle")}
				</DialogTitle>
				<DialogDescription>{getGreeting()}</DialogDescription>
			</DialogHeader>

			<div className="grid gap-3">
				{/* The end date is ignored while the return is unknown. */}
				<div
					className={cn("flex justify-center", isIndefinite && "opacity-50")}
					inert={isIndefinite}
				>
					<Calendar
						mode="range"
						selected={range}
						onSelect={handleSelect}
						disabled={isDayDisabled}
						excludeDisabled
						resetOnSelect={!isActiveEdit}
						defaultMonth={range?.from ?? dateKeyToCalendarDate(todayKey)}
						today={dateKeyToCalendarDate(todayKey)}
						locale={dateLocale}
						className="rounded-xl border border-border/60"
					/>
				</div>

				{isEdit ? null : (
					// Reserve the height so picking a future start doesn't shift the dialog.
					<div className="grid min-h-18 content-start gap-2">
						{showOptions ? (
							<>
								<div className="flex h-8 items-center gap-2">
									<Checkbox
										id={indefiniteId}
										checked={isIndefinite}
										onCheckedChange={(checked) =>
											handleOptionChange("indefinite", checked === true)
										}
									/>
									<Label htmlFor={indefiniteId} className="font-normal">
										{isSelf
											? t("absent.indefiniteOption")
											: t("absent.indefiniteOptionOther")}
									</Label>
								</div>
								<div className="flex h-8 items-center gap-2">
									<Checkbox
										id={todayId}
										checked={returnsToday}
										onCheckedChange={(checked) =>
											handleOptionChange("today", checked === true)
										}
									/>
									<Label htmlFor={todayId} className="font-normal">
										{isSelf
											? t("absent.returnTodayOption")
											: t("absent.returnTodayOptionOther")}
									</Label>
									{returnsToday ? (
										<>
											<Input
												type="time"
												value={returnTime}
												onChange={(e) => {
													setSubmitError(null);
													setReturnTime(e.target.value);
												}}
												aria-label={t("absent.returnTime")}
												className="h-8 w-28"
											/>
											{showTeamTimeZone ? (
												<span className="truncate text-xs text-muted-foreground">
													{teamTimezone}
												</span>
											) : null}
										</>
									) : null}
								</div>
							</>
						) : null}
					</div>
				)}

				{/* Fixed height: picking dates must not make the dialog jump. */}
				<div className="calm-subtle-panel grid min-h-18 content-start gap-1 p-3 text-sm">
					{renderPreview()}
				</div>
				{shownError ? (
					<p role="alert" className="text-sm text-destructive">
						{t(`absent.plan.errors.${shownError}`)}
					</p>
				) : null}
				{isEdit ? null : (
					<p className="text-xs text-muted-foreground">
						{isSelf
							? t("absent.permanentRotationHintSelf")
							: t("absent.permanentRotationHintOther", {
									name: reviewer.name,
								})}
					</p>
				)}
			</div>

			<DialogFooter>
				{absence ? (
					<Button
						variant="outline"
						className="text-destructive sm:mr-auto"
						onClick={() => void handleCancelPlan()}
						disabled={isSubmitting}
					>
						{isActiveEdit ? t("absent.endNow") : t("absent.cancelPlan")}
					</Button>
				) : (
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						{t("common.cancel")}
					</Button>
				)}
				<Button
					onClick={() => void handleSubmit()}
					disabled={isSubmitting || !canSubmit}
				>
					{isSubmitting ? t("common.saving") : submitLabel}
				</Button>
			</DialogFooter>
		</>
	);
}
