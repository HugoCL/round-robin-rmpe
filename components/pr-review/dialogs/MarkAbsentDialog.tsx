"use client";

import type { DateRange } from "@daypicker/react";
import { format, isSameDay, parse, setHours, setMinutes } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Doc } from "@/convex/_generated/dataModel";
import {
	absenceCoversDay,
	addDaysToDateKey,
	compareDateKeys,
	countWeekdaysInRange,
	type DateKeyRange,
	getAbsenceReturnAt,
	getTodayDateKey,
	validateAbsenceRange,
} from "@/lib/plannedAbsences";
import type { UserInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePRReview } from "../PRReviewContext";

const DATE_KEY_FORMAT = "yyyy-MM-dd";

export type AbsenceDialogMode = "now" | "plan";

type PlanValidationError = NonNullable<ReturnType<typeof validateAbsenceRange>>;

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
	/** Tab shown when the dialog opens. Defaults to "now". */
	initialMode?: AbsenceDialogMode;
	/** Pre-selected dates for the "plan" tab. */
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
	initialMode = "now",
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
	const [mode, setMode] = useState<AbsenceDialogMode>(
		isEdit ? "plan" : initialMode,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
	const [selectedTime, setSelectedTime] = useState<string>("");
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [now] = useState(() => Date.now());
	const [planRange, setPlanRange] = useState<DateRange | undefined>(() => {
		const initial = absence ?? initialRange;
		return initial
			? {
					from: dateKeyToCalendarDate(initial.startDate),
					to: dateKeyToCalendarDate(initial.endDate),
				}
			: undefined;
	});

	const timeId = useId();
	const dateLocale = locale.startsWith("es") ? es : enUS;

	// Check if current user is marking themselves as absent
	const isSelf =
		currentUser?.email?.toLowerCase() === reviewer.email.toLowerCase();

	// Compute final absentUntil timestamp
	const computeAbsentUntil = (): number | undefined => {
		if (!selectedDate && !selectedTime) {
			return undefined;
		}

		let date = selectedDate || new Date();

		if (selectedTime) {
			const [hours, minutes] = selectedTime.split(":").map(Number);
			date = setMinutes(setHours(date, hours), minutes);
		} else if (selectedDate) {
			// If only date is selected, set to start of day (00:00)
			// This ensures the person is marked as available at midnight of their return date
			date = setMinutes(setHours(date, 0), 0);
		}

		return date.getTime();
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const absentUntil = computeAbsentUntil();
			await onMarkAbsent(absentUntil);
			onOpenChange(false);
			// Reset state
			setSelectedDate(undefined);
			setSelectedTime("");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			// Reset state when closing
			setSelectedDate(undefined);
			setSelectedTime("");
		}
		onOpenChange(open);
	};

	// Format the selected return date/time for display
	const formatReturnInfo = () => {
		if (!selectedDate && !selectedTime) {
			return t("absent.noReturnDateSet");
		}

		const date = selectedDate || new Date();
		const todayDate = new Date();

		if (selectedTime) {
			const [hours, minutes] = selectedTime.split(":").map(Number);
			const dateWithTime = setMinutes(setHours(date, hours), minutes);

			if (isSameDay(date, todayDate)) {
				return t("absent.returningTodayAt", { time: selectedTime });
			}
			return t("absent.returningOn", {
				date: format(dateWithTime, "PPP", { locale: dateLocale }),
				time: selectedTime,
			});
		}

		if (isSameDay(date, todayDate)) {
			return t("absent.returningLaterToday");
		}
		return t("absent.returningOn", {
			date: format(date, "PPP", { locale: dateLocale }),
			time: "",
		});
	};

	// Generate greeting message
	const getGreeting = () => {
		if (isSelf) {
			const firstName = currentUser?.firstName || reviewer.name.split(" ")[0];
			return t("absent.greetingSelf", { name: firstName });
		}
		return t("absent.greetingOther", { name: reviewer.name });
	};

	// --- Planned absence ("plan" tab and edit mode) ---------------------------
	const todayKey = getTodayDateKey(now, teamTimezone);
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
	const keyRange: DateKeyRange | null = planRange?.from
		? {
				startDate: format(planRange.from, DATE_KEY_FORMAT),
				endDate: format(planRange.to ?? planRange.from, DATE_KEY_FORMAT),
			}
		: null;
	const validatePlan = (
		range: DateKeyRange,
		today: string,
	): PlanValidationError | null =>
		isActiveEdit
			? // The start already passed: only the end can change, and it can't be
				// earlier than today.
				(validateAbsenceRange({
					range,
					todayKey: range.startDate,
					existing: otherRanges,
				}) ??
				(compareDateKeys(range.endDate, today) < 0 ? "startInPast" : null))
			: validateAbsenceRange({ range, todayKey: today, existing: otherRanges });
	const renderError = keyRange ? validatePlan(keyRange, todayKey) : null;
	// Set when a submit-time check (against the real "today") fails.
	const [submitError, setSubmitError] = useState<PlanValidationError | null>(
		null,
	);
	const planError = renderError ?? submitError;
	const canSubmitPlan = keyRange !== null && planError === null;

	const isPlanDayDisabled = (date: Date) => {
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

	const handlePlanSubmit = async () => {
		if (!keyRange || planError) return;
		// The dialog may have been open across midnight: check against the real
		// team "today" instead of the one captured on open.
		const failure = validatePlan(
			keyRange,
			getTodayDateKey(Date.now(), teamTimezone),
		);
		if (failure) {
			setSubmitError(failure);
			return;
		}
		setIsSubmitting(true);
		try {
			const ok = absence
				? await onUpdateAbsence(absence._id, keyRange)
				: await onScheduleAbsence(reviewer._id, keyRange);
			if (ok) onOpenChange(false);
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

	const renderPlanPreview = () => {
		if (!keyRange) return null;
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
		const returnTime = new Intl.DateTimeFormat(locale, {
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
						time: returnTime,
						timeZone: teamTimezone,
					})
				: t("absent.planReturnLocal", { date: returnDate, time: returnTime });
		} else {
			returnText = showTimeZone
				? t("absent.planReturnOther", {
						name: reviewer.name,
						date: returnDate,
						time: returnTime,
						timeZone: teamTimezone,
					})
				: t("absent.planReturnOtherLocal", {
						name: reviewer.name,
						date: returnDate,
						time: returnTime,
					});
		}
		return (
			<div className="calm-subtle-panel grid gap-1 p-3 text-sm">
				<p className="font-medium">
					{t("absent.planPreview", {
						start: formatDateKeyDay(keyRange.startDate, locale),
						end: formatDateKeyDay(keyRange.endDate, locale),
						days: countWeekdaysInRange(keyRange),
					})}
				</p>
				<p className="text-muted-foreground">{returnText}</p>
			</div>
		);
	};

	const handlePlanSelect = (
		range: DateRange | undefined,
		triggerDate: Date,
	) => {
		setSubmitError(null);
		if (isActiveEdit && absence) {
			// The start is locked: whatever day is clicked becomes the new end.
			setPlanRange({
				from: dateKeyToCalendarDate(absence.startDate),
				to: triggerDate,
			});
			return;
		}
		setPlanRange(range);
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{isEdit ? t("absent.editTitle") : t("absent.markAbsentTitle")}
				</DialogTitle>
				<DialogDescription>{getGreeting()}</DialogDescription>
			</DialogHeader>

			{isEdit ? null : (
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					value={mode}
					onValueChange={(value) => {
						if (value === "now" || value === "plan") setMode(value);
					}}
					className="w-full"
					aria-label={t("absent.markAbsentTitle")}
				>
					<ToggleGroupItem value="now" className="flex-1">
						{t("absent.modeNow")}
					</ToggleGroupItem>
					<ToggleGroupItem value="plan" className="flex-1">
						{t("absent.modePlan")}
					</ToggleGroupItem>
				</ToggleGroup>
			)}

			{mode === "plan" ? (
				<>
					<div className="grid gap-3">
						<div className="flex justify-center">
							<Calendar
								mode="range"
								selected={planRange}
								onSelect={handlePlanSelect}
								disabled={isPlanDayDisabled}
								excludeDisabled
								resetOnSelect={!isActiveEdit}
								defaultMonth={
									planRange?.from ?? dateKeyToCalendarDate(todayKey)
								}
								today={dateKeyToCalendarDate(todayKey)}
								locale={dateLocale}
								className="rounded-xl border border-border/60"
							/>
						</div>
						{renderPlanPreview()}
						{planError ? (
							<p role="alert" className="text-sm text-destructive">
								{t(`absent.plan.errors.${planError}`)}
							</p>
						) : null}
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
							onClick={() => void handlePlanSubmit()}
							disabled={isSubmitting || !canSubmitPlan}
						>
							{isSubmitting
								? t("common.saving")
								: absence
									? t("common.save")
									: t("absent.planSubmit")}
						</Button>
					</DialogFooter>
				</>
			) : (
				<>
					<div className="grid gap-4">
						{/* Date Picker */}
						<div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label className="sm:text-right">{t("absent.returnDate")}</Label>
							<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className={cn(
											"justify-start text-left font-normal sm:col-span-3",
											!selectedDate && "text-muted-foreground",
										)}
									>
										<CalendarIcon className="mr-2 h-4 w-4" />
										{selectedDate
											? format(selectedDate, "PPP", {
													locale: dateLocale,
												})
											: t("absent.selectDate")}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={selectedDate}
										onSelect={(date) => {
											setSelectedDate(date);
											setCalendarOpen(false);
										}}
										disabled={(date) =>
											date < new Date(new Date().setHours(0, 0, 0, 0))
										}
										locale={dateLocale}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
						</div>

						{/* Time Picker */}
						<div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label htmlFor={timeId} className="sm:text-right">
								{t("absent.returnTime")}
							</Label>
							<div className="flex items-center gap-2 sm:col-span-3">
								<Clock className="h-4 w-4 text-muted-foreground" />
								<Input
									id={timeId}
									type="time"
									value={selectedTime}
									onChange={(e) => setSelectedTime(e.target.value)}
									className="flex-1"
									placeholder="HH:MM"
								/>
							</div>
						</div>

						{/* Preview */}
						{(selectedDate || selectedTime) && (
							<div className="calm-subtle-panel p-3 text-sm">
								<p className="text-muted-foreground">{formatReturnInfo()}</p>
							</div>
						)}

						<div className="grid gap-1.5 text-xs text-muted-foreground">
							<p>{t("absent.optionalReturnInfo")}</p>
							<p>
								{isSelf
									? t("absent.permanentRotationHintSelf")
									: t("absent.permanentRotationHintOther", {
											name: reviewer.name,
										})}
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={isSubmitting}
						>
							{t("common.cancel")}
						</Button>
						<Button onClick={handleSubmit} disabled={isSubmitting}>
							{isSubmitting ? t("common.saving") : t("absent.markAbsent")}
						</Button>
					</DialogFooter>
				</>
			)}
		</>
	);
}
