"use client";

import { useMutation } from "convex/react";
import { Calendar, Clock, Globe, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EditEventScheduleDialogProps {
	eventId: Id<"events">;
	eventTitle: string;
	scheduledAt: number;
	trigger?: React.ReactNode;
}

function getUserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "Local";
	}
}

function getChileTimePreview(date: Date | undefined, time: string): string {
	if (!date || !time) return "";

	const [hours, minutes] = time.split(":").map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";

	const localDate = new Date(date);
	localDate.setHours(hours, minutes, 0, 0);

	return localDate.toLocaleTimeString("es-CL", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "America/Santiago",
	});
}

function isUserInChile(): boolean {
	const tz = getUserTimezone();
	return tz === "America/Santiago" || tz.includes("Chile");
}

function dateAndTimeFromTimestamp(timestamp: number) {
	const scheduled = new Date(timestamp);
	const date = new Date(
		scheduled.getFullYear(),
		scheduled.getMonth(),
		scheduled.getDate(),
	);
	const time = scheduled.toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
	});
	return { date, time };
}

export function EditEventScheduleDialog({
	eventId,
	eventTitle,
	scheduledAt,
	trigger,
}: EditEventScheduleDialogProps) {
	const t = useTranslations();
	const locale = useLocale();
	const timeId = useId();

	const [open, setOpen] = useState(false);
	const [date, setDate] = useState<Date | undefined>();
	const [time, setTime] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const updateScheduleMutation = useMutation(api.mutations.updateEventSchedule);

	const userTimezone = useMemo(() => getUserTimezone(), []);
	const userInChile = useMemo(() => isUserInChile(), []);
	const chileTimePreview = useMemo(
		() => getChileTimePreview(date, time),
		[date, time],
	);

	useEffect(() => {
		if (open) {
			const { date: initialDate, time: initialTime } =
				dateAndTimeFromTimestamp(scheduledAt);
			setDate(initialDate);
			setTime(initialTime);
		}
	}, [open, scheduledAt]);

	const handleSubmit = async () => {
		if (!date) {
			toast({
				title: t("common.error"),
				description: t("events.dateRequired"),
				variant: "destructive",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			const [hours, minutes] = time.split(":").map(Number);
			const nextScheduledAt = new Date(date);
			nextScheduledAt.setHours(hours, minutes, 0, 0);

			const result = await updateScheduleMutation({
				eventId,
				scheduledAt: nextScheduledAt.getTime(),
			});

			if (result.success) {
				toast({
					title: t("events.scheduleUpdated"),
					description: t("events.scheduleUpdatedDescription"),
				});
				setOpen(false);
				return;
			}

			toast({
				title: t("common.error"),
				description:
					result.error === "Only scheduled events can be rescheduled"
						? t("events.scheduleNotEditable")
						: result.error || t("events.scheduleUpdateFailed"),
				variant: "destructive",
			});
		} catch (error) {
			console.error("Error updating event schedule:", error);
			toast({
				title: t("common.error"),
				description: t("events.scheduleUpdateFailed"),
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const formatDate = (value: Date) => {
		return value.toLocaleDateString(locale, {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button variant="outline" size="sm">
						<Pencil className="h-4 w-4 mr-1" />
						{t("events.editSchedule")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("events.editSchedule")}</DialogTitle>
					<DialogDescription>
						{t("events.editScheduleDescription", { title: eventTitle })}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label>{t("events.date")}</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"justify-start text-left font-normal",
										!date && "text-muted-foreground",
									)}
								>
									<Calendar className="mr-2 h-4 w-4" />
									{date ? formatDate(date) : t("events.selectDate")}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<CalendarComponent
									mode="single"
									selected={date}
									onSelect={setDate}
									autoFocus
								/>
							</PopoverContent>
						</Popover>
					</div>

					<div className="grid gap-2">
						<Label htmlFor={timeId}>{t("events.time")}</Label>
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<Input
								id={timeId}
								type="time"
								value={time}
								onChange={(e) => setTime(e.target.value)}
								className="w-auto"
							/>
							<span className="text-xs text-muted-foreground">
								(
								{userTimezone.split("/").pop()?.replace("_", " ") ||
									t("events.yourTime")}
								)
							</span>
						</div>
						{!userInChile && chileTimePreview && (
							<div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-2 py-1">
								<Globe className="h-3.5 w-3.5" />
								<span>
									{t("events.chileTimePreview", { time: chileTimePreview })}
								</span>
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? t("common.saving") : t("events.saveSchedule")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
