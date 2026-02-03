"use client";

import { format, isSameDay, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
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
import type { Doc } from "@/convex/_generated/dataModel";
import type { UserInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MarkAbsentDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	reviewer: Doc<"reviewers">;
	currentUser: UserInfo | null;
	onMarkAbsent: (absentUntil?: number) => Promise<void>;
}

export function MarkAbsentDialog({
	isOpen,
	onOpenChange,
	reviewer,
	currentUser,
	onMarkAbsent,
}: MarkAbsentDialogProps) {
	const t = useTranslations();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
	const [selectedTime, setSelectedTime] = useState<string>("");
	const [calendarOpen, setCalendarOpen] = useState(false);

	const timeId = useId();

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
				date: format(dateWithTime, "PPP"),
				time: selectedTime,
			});
		}

		if (isSameDay(date, todayDate)) {
			return t("absent.returningLaterToday");
		}
		return t("absent.returningOn", {
			date: format(date, "PPP"),
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

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("absent.markAbsentTitle")}</DialogTitle>
					<DialogDescription>{getGreeting()}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					{/* Date Picker */}
					<div className="grid grid-cols-4 items-center gap-4">
						<Label className="text-right">{t("absent.returnDate")}</Label>
						<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"col-span-3 justify-start text-left font-normal",
										!selectedDate && "text-muted-foreground",
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{selectedDate
										? format(selectedDate, "PPP", { locale: es })
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
									locale={es}
									initialFocus
								/>
							</PopoverContent>
						</Popover>
					</div>

					{/* Time Picker */}
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={timeId} className="text-right">
							{t("absent.returnTime")}
						</Label>
						<div className="col-span-3 flex items-center gap-2">
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
						<div className=" bg-muted p-3 text-sm">
							<p className="text-muted-foreground">{formatReturnInfo()}</p>
						</div>
					)}

					<p className="text-xs text-muted-foreground">
						{t("absent.optionalReturnInfo")}
					</p>
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
			</DialogContent>
		</Dialog>
	);
}
