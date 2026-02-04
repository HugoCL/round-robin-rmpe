"use client";

import { useAction, useMutation } from "convex/react";
import { Calendar, Clock, Globe, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePRReview } from "../PRReviewContext";

interface CreateEventDialogProps {
	trigger?: React.ReactNode;
}

// Get user's timezone name
function getUserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "Local";
	}
}

// Convert a local time to Chile time for display
function getChileTimePreview(date: Date | undefined, time: string): string {
	if (!date || !time) return "";

	const [hours, minutes] = time.split(":").map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";

	const localDate = new Date(date);
	localDate.setHours(hours, minutes, 0, 0);

	// Format the same moment in Chile timezone
	return localDate.toLocaleTimeString("es-CL", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "America/Santiago",
	});
}

// Check if user is in Chile timezone
function isUserInChile(): boolean {
	const tz = getUserTimezone();
	return tz === "America/Santiago" || tz.includes("Chile");
}

export function CreateEventDialog({ trigger }: CreateEventDialogProps) {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug, userInfo } = usePRReview();

	// Generate unique IDs for form elements
	const titleId = useId();
	const descriptionId = useId();
	const timeId = useId();
	const sendInviteId = useId();

	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [date, setDate] = useState<Date | undefined>(new Date());
	const [time, setTime] = useState(
		new Date().toLocaleTimeString("en-US", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
		}),
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [sendInvite, setSendInvite] = useState(true);

	const userTimezone = useMemo(() => getUserTimezone(), []);
	const userInChile = useMemo(() => isUserInChile(), []);
	const chileTimePreview = useMemo(
		() => getChileTimePreview(date, time),
		[date, time],
	);

	// Update date and time to current values when dialog opens
	useEffect(() => {
		if (open) {
			setDate(new Date());
			setTime(
				new Date().toLocaleTimeString("en-US", {
					hour12: false,
					hour: "2-digit",
					minute: "2-digit",
				}),
			);
		}
	}, [open]);

	const createEventMutation = useMutation(api.mutations.createEvent);
	const sendEventInviteAction = useAction(api.actions.sendEventInvite);

	const handleSubmit = async () => {
		if (!title.trim()) {
			toast({
				title: t("common.error"),
				description: t("events.titleRequired"),
				variant: "destructive",
			});
			return;
		}

		if (!date) {
			toast({
				title: t("common.error"),
				description: t("events.dateRequired"),
				variant: "destructive",
			});
			return;
		}

		if (!teamSlug) {
			toast({
				title: t("common.error"),
				description: t("messages.missingTeam"),
				variant: "destructive",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			// Combine date and time in user's local timezone
			// JavaScript Date automatically handles the conversion to UTC
			const [hours, minutes] = time.split(":").map(Number);
			const scheduledAt = new Date(date);
			scheduledAt.setHours(hours, minutes, 0, 0);

			const createdBy = {
				email: userInfo?.email || "unknown@example.com",
				name:
					userInfo?.firstName && userInfo?.lastName
						? `${userInfo.firstName} ${userInfo.lastName}`
						: userInfo?.firstName || userInfo?.lastName || "Unknown",
				googleChatUserId: undefined, // Could be populated if we have this info
			};

			const result = await createEventMutation({
				teamSlug,
				title: title.trim(),
				description: description.trim() || undefined,
				scheduledAt: scheduledAt.getTime(),
				createdBy,
			});

			if (result.success && result.eventId) {
				toast({
					title: t("events.created"),
					description: t("events.createdDescription"),
				});

				// Send invite to Google Chat if enabled
				if (sendInvite) {
					try {
						const appBaseUrl = window.location.origin;
						// Format date and time using Chile timezone for consistency
						// This ensures all team members see the same time in messages
						const formattedDate = scheduledAt.toLocaleDateString("es-CL", {
							weekday: "long",
							day: "numeric",
							month: "long",
							timeZone: "America/Santiago",
						});
						const formattedTime = scheduledAt.toLocaleTimeString("es-CL", {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false,
							timeZone: "America/Santiago",
						});
						await sendEventInviteAction({
							eventId: result.eventId,
							teamSlug,
							appBaseUrl,
							locale,
							formattedDate,
							formattedTime,
						});
					} catch (e) {
						console.warn("Failed to send event invite:", e);
					}
				}

				// Reset form
				setTitle("");
				setDescription("");
				setDate(new Date());
				setTime(
					new Date().toLocaleTimeString("en-US", {
						hour12: false,
						hour: "2-digit",
						minute: "2-digit",
					}),
				);
				setOpen(false);
			}
		} catch (error) {
			console.error("Error creating event:", error);
			toast({
				title: t("common.error"),
				description: t("events.createFailed"),
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const formatDate = (date: Date) => {
		return date.toLocaleDateString(locale, {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" size="sm">
						<Plus className="h-4 w-4 mr-2" />
						{t("events.createEvent")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("events.createEvent")}</DialogTitle>
					<DialogDescription>{t("events.createDescription")}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					{/* Title */}
					<div className="grid gap-2">
						<Label htmlFor={titleId}>{t("events.title")}</Label>
						<Input
							id={titleId}
							placeholder={t("events.titlePlaceholder")}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>

					{/* Description */}
					<div className="grid gap-2">
						<Label htmlFor={descriptionId}>
							{t("events.description")}{" "}
							<span className="text-muted-foreground text-xs">
								({t("common.optional")})
							</span>
						</Label>
						<Textarea
							id={descriptionId}
							placeholder={t("events.descriptionPlaceholder")}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
						/>
					</div>

					{/* Date */}
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
									initialFocus
								/>
							</PopoverContent>
						</Popover>
					</div>

					{/* Time */}
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
						{/* Show Chile time conversion if user is not in Chile */}
						{!userInChile && chileTimePreview && (
							<div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50  px-2 py-1">
								<Globe className="h-3.5 w-3.5" />
								<span>
									{t("events.chileTimePreview", { time: chileTimePreview })}
								</span>
							</div>
						)}
					</div>

					{/* Send invite toggle */}
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id={sendInviteId}
							checked={sendInvite}
							onChange={(e) => setSendInvite(e.target.checked)}
							className=""
						/>
						<Label htmlFor={sendInviteId} className="text-sm font-normal">
							{t("events.sendInviteToChat")}
						</Label>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? t("common.creating") : t("events.createEvent")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
