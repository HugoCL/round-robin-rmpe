"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Calendar,
	Check,
	Clock,
	Trash2,
	User,
	UserCheck,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { usePRReview } from "./PRReviewContext";

const SECOND_IN_MS = 1000;
const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

function padCountdownValue(value: number) {
	return String(value).padStart(2, "0");
}

function formatCountdown(milliseconds: number) {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / SECOND_IN_MS));
	const days = Math.floor(totalSeconds / DAY_IN_SECONDS);
	const hours = Math.floor((totalSeconds % DAY_IN_SECONDS) / HOUR_IN_SECONDS);
	const minutes = Math.floor(
		(totalSeconds % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS,
	);
	const seconds = totalSeconds % MINUTE_IN_SECONDS;
	const time = `${padCountdownValue(hours)}:${padCountdownValue(minutes)}:${padCountdownValue(seconds)}`;
	return days > 0 ? `${days}d ${time}` : time;
}

export function ActiveEventsList() {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug, userInfo, reviewers } = usePRReview();
	const [now, setNow] = useState(() => Date.now());

	const events = useQuery(
		api.queries.getActiveEvents,
		teamSlug ? { teamSlug } : "skip",
	);
	type EventItem = NonNullable<typeof events>[number];

	const joinEventMutation = useMutation(api.mutations.joinEvent);
	const leaveEventMutation = useMutation(api.mutations.leaveEvent);
	const cancelEventMutation = useMutation(api.mutations.cancelEvent);
	const completeEventMutation = useMutation(api.mutations.completeEvent);
	const addParticipantMutation = useMutation(api.mutations.addEventParticipant);

	useEffect(() => {
		if (!events?.length) return;
		const intervalId = window.setInterval(() => {
			setNow(Date.now());
		}, SECOND_IN_MS);

		return () => window.clearInterval(intervalId);
	}, [events?.length]);

	const sortedEvents = useMemo(
		() =>
			events ? [...events].sort((a, b) => a.scheduledAt - b.scheduledAt) : [],
		[events],
	);

	const formatDateTime = (timestamp: number) => {
		const date = new Date(timestamp);
		const dateStr = date.toLocaleDateString(locale, {
			weekday: "short",
			day: "numeric",
			month: "short",
		});
		const timeStr = date.toLocaleTimeString(locale, {
			hour: "2-digit",
			minute: "2-digit",
		});
		return { dateStr, timeStr };
	};

	const isParticipating = (event: EventItem) => {
		return event.participants.some(
			(p) => p.email.toLowerCase() === userInfo?.email?.toLowerCase(),
		);
	};

	const isCreator = (event: EventItem) => {
		return (
			event.createdBy.email.toLowerCase() === userInfo?.email?.toLowerCase()
		);
	};

	const handleJoin = async (eventId: Id<"events">) => {
		if (!userInfo?.email) {
			toast({
				title: t("common.error"),
				description: t("events.mustBeLoggedIn"),
				variant: "destructive",
			});
			return;
		}

		try {
			const result = await joinEventMutation({
				eventId,
				participant: {
					email: userInfo.email,
					name:
						userInfo.firstName && userInfo.lastName
							? `${userInfo.firstName} ${userInfo.lastName}`
							: userInfo.firstName || userInfo.lastName || "Unknown",
				},
			});

			if (result.success) {
				toast({
					title: t("events.joined"),
					description: t("events.joinedDescription"),
				});
			} else if (result.alreadyJoined) {
				toast({
					title: t("common.info"),
					description: t("events.alreadyJoined"),
				});
			} else {
				toast({
					title: t("common.error"),
					description: result.error || t("events.joinFailed"),
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error joining event:", error);
			toast({
				title: t("common.error"),
				description: t("events.joinFailed"),
				variant: "destructive",
			});
		}
	};

	const handleLeave = async (eventId: Id<"events">) => {
		if (!userInfo?.email) return;

		try {
			const result = await leaveEventMutation({
				eventId,
				email: userInfo.email,
			});

			if (result.success) {
				toast({
					title: t("events.left"),
					description: t("events.leftDescription"),
				});
			}
		} catch (error) {
			console.error("Error leaving event:", error);
			toast({
				title: t("common.error"),
				description: t("events.leaveFailed"),
				variant: "destructive",
			});
		}
	};

	const handleCancel = async (eventId: Id<"events">) => {
		try {
			const result = await cancelEventMutation({ eventId });

			if (result.success) {
				toast({
					title: t("events.cancelled"),
					description: t("events.cancelledDescription"),
				});
			}
		} catch (error) {
			console.error("Error cancelling event:", error);
			toast({
				title: t("common.error"),
				description: t("events.cancelFailed"),
				variant: "destructive",
			});
		}
	};

	const handleComplete = async (eventId: Id<"events">) => {
		try {
			const result = await completeEventMutation({ eventId });

			if (result.success) {
				toast({
					title: t("events.completed"),
					description: t("events.completedDescription"),
				});
			}
		} catch (error) {
			console.error("Error completing event:", error);
			toast({
				title: t("common.error"),
				description: t("events.completeFailed"),
				variant: "destructive",
			});
		}
	};

	const handleAddParticipant = async (
		eventId: Id<"events">,
		reviewerId: Id<"reviewers">,
	) => {
		try {
			const result = await addParticipantMutation({ eventId, reviewerId });

			if (result.success) {
				toast({
					title: t("events.participantAdded"),
					description: t("events.participantAddedDescription", {
						name: result.addedName || "",
					}),
				});
			} else if (result.alreadyJoined) {
				toast({
					title: t("common.info"),
					description: t("events.alreadyJoined"),
				});
			} else {
				toast({
					title: t("common.error"),
					description: result.error || t("events.addParticipantFailed"),
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error adding participant:", error);
			toast({
				title: t("common.error"),
				description: t("events.addParticipantFailed"),
				variant: "destructive",
			});
		}
	};

	// Get reviewers that are not yet participants in an event
	const getAvailableReviewers = (event: EventItem) => {
		return reviewers.filter(
			(r) =>
				!event.participants.some(
					(p) => p.email.toLowerCase() === r.email.toLowerCase(),
				),
		);
	};

	if (!sortedEvents.length) {
		return null;
	}

	return (
		<div className="w-full space-y-2">
			{sortedEvents.map((event) => {
				const { dateStr, timeStr } = formatDateTime(event.scheduledAt);
				const participating = isParticipating(event);
				const creator = isCreator(event);
				const remaining = event.scheduledAt - now;
				const isPast = remaining <= 0;

				return (
					<div
						key={event._id}
						className="rounded-md border border-border/70 bg-muted/10 p-4"
					>
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="min-w-0 flex-1 space-y-2.5">
								<div className="flex flex-wrap items-center gap-2">
									<p className="truncate text-sm font-semibold leading-tight">
										{event.title}
									</p>
									{event.status === "started" && (
										<Badge variant="default" className="h-6 text-xs">
											{t("events.inProgress")}
										</Badge>
									)}
									{event.status === "scheduled" && isPast && (
										<Badge variant="secondary" className="h-6 text-xs">
											{t("events.starting")}
										</Badge>
									)}
									{event.status === "scheduled" && !isPast && (
										<Badge
											variant="outline"
											className="h-6 gap-1 font-mono text-xs tabular-nums"
										>
											<Clock className="h-3 w-3" />
											{formatCountdown(remaining)}
										</Badge>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-2.5 mt-4">
									<span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/60 bg-background/25 px-2.5 text-xs text-muted-foreground">
										<User className="h-3 w-3 shrink-0" />
										{t("events.createdBy", {
											name: event.createdBy.name,
										})}
									</span>
									<span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/60 bg-background/25 px-2.5 text-xs text-muted-foreground">
										<Calendar className="h-3 w-3 shrink-0" />
										{dateStr}
									</span>
									<span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/60 bg-background/25 px-2.5 text-xs text-muted-foreground">
										<Clock className="h-3 w-3 shrink-0" />
										{timeStr}
									</span>
									<span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/60 bg-background/25 px-2.5 text-xs text-muted-foreground">
										<Users className="h-3 w-3 shrink-0" />
										{event.participants.length}
									</span>
								</div>

								{event.description && (
									<p className="truncate text-xs text-muted-foreground">
										{event.description}
									</p>
								)}
							</div>

							<div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end lg:pl-4">
								{event.status === "scheduled" &&
									(participating ? (
										<Button
											variant="outline"
											size="sm"
											className="text-destructive"
											onClick={() => handleLeave(event._id)}
										>
											<UserMinus className="h-4 w-4 mr-1" />
											{t("events.leave")}
										</Button>
									) : (
										<Button
											variant="default"
											size="sm"
											onClick={() => handleJoin(event._id)}
										>
											<UserCheck className="h-4 w-4 mr-1" />
											{t("events.join")}
										</Button>
									))}

								{/* Add participants popover - visible to creator */}
								{creator &&
									event.status === "scheduled" &&
									getAvailableReviewers(event).length > 0 && (
										<Popover>
											<PopoverTrigger asChild>
												<Button variant="outline" size="sm">
													<UserPlus className="h-4 w-4 mr-1" />
													{t("events.addParticipant")}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-56 p-2" align="end">
												<div className="space-y-1">
													<p className="text-sm font-medium mb-2">
														{t("events.selectTeamMember")}
													</p>
													<div className="max-h-48 overflow-y-auto space-y-1">
														{getAvailableReviewers(event).map((reviewer) => (
															<Button
																key={reviewer._id}
																variant="ghost"
																size="sm"
																className="w-full justify-start text-left"
																onClick={() =>
																	handleAddParticipant(event._id, reviewer._id)
																}
															>
																{reviewer.name}
															</Button>
														))}
													</div>
												</div>
											</PopoverContent>
										</Popover>
									)}

								{/* Complete button - visible to creator when event is started */}
								{creator && event.status === "started" && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="icon"
													className="h-8 w-8 text-green-600 hover:text-green-600"
													onClick={() => handleComplete(event._id)}
												>
													<Check className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												{t("events.completeEvent")}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}

								{/* Cancel button - visible to creator when scheduled */}
								{creator && event.status === "scheduled" && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="icon"
													className="h-8 w-8 text-destructive hover:text-destructive"
													onClick={() => handleCancel(event._id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>{t("events.cancelEvent")}</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
