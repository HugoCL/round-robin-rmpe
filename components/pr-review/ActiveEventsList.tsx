"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Calendar,
	Check,
	Clock,
	Ellipsis,
	Trash2,
	UserCheck,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EditEventScheduleDialog } from "./dialogs/EditEventScheduleDialog";
import { NoticeLine } from "./NoticeLine";
import { usePRReview } from "./PRReviewContext";

const SECOND_IN_MS = 1000;
const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const DAY_IN_MS = DAY_IN_SECONDS * SECOND_IN_MS;
/** Inside this window the lane shows a live countdown instead of a time. */
const COUNTDOWN_WINDOW_MS = HOUR_IN_SECONDS * SECOND_IN_MS;

const eventActionsId = (eventId: Id<"events">) => `event-actions-${eventId}`;

function startOfDay(timestamp: number) {
	return new Date(timestamp).setHours(0, 0, 0, 0);
}

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
	const { teamSlug, userInfo, reviewers, canManageCurrentTeam } = usePRReview();
	const [now, setNow] = useState(() => Date.now());
	const [reschedulingId, setReschedulingId] = useState<Id<"events"> | null>(
		null,
	);

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

	// "today", "tomorrow", a weekday: the lane states when, not a ticking
	// clock, until the last hour.
	const whenLabel = (event: EventItem, remaining: number) => {
		if (event.status === "started") return t("events.inProgress");
		if (remaining <= 0) return t("events.starting");
		if (remaining < COUNTDOWN_WINDOW_MS) return formatCountdown(remaining);
		const { dateStr, timeStr } = formatDateTime(event.scheduledAt);
		const dayDiff = Math.round(
			(startOfDay(event.scheduledAt) - startOfDay(now)) / DAY_IN_MS,
		);
		const day =
			dayDiff <= 1
				? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
						dayDiff,
						"day",
					)
				: dateStr;
		return `${day} · ${timeStr}`;
	};

	return sortedEvents.map((event) => {
		const participating = isParticipating(event);
		const creator = isCreator(event);
		const remaining = event.scheduledAt - now;
		const addable = getAvailableReviewers(event);
		const names = event.participants.map((participant) => participant.name);

		return (
			<NoticeLine
				key={event._id}
				icon={Calendar}
				action={
					<div className="flex shrink-0 items-center gap-1">
						{event.status === "scheduled" ? (
							participating ? (
								<Button
									variant="ghost"
									size="sm"
									className="rounded-full text-muted-foreground hover:text-destructive"
									onClick={() => handleLeave(event._id)}
								>
									<UserMinus data-icon="inline-start" />
									{t("events.leave")}
								</Button>
							) : (
								<Button
									size="sm"
									className="rounded-full"
									onClick={() => handleJoin(event._id)}
								>
									<UserCheck data-icon="inline-start" />
									{t("events.join")}
								</Button>
							)
						) : null}
						{creator ? (
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<IconActionButton
										id={eventActionsId(event._id)}
										label={t("reviewersPanel.moreActions")}
										className="size-8 text-muted-foreground"
									>
										<Ellipsis />
									</IconActionButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									{event.status === "scheduled" && addable.length > 0 ? (
										<DropdownMenuSub>
											<DropdownMenuSubTrigger>
												<UserPlus />
												{t("events.addParticipant")}
											</DropdownMenuSubTrigger>
											<DropdownMenuSubContent className="max-h-64 overflow-y-auto">
												{addable.map((reviewer) => (
													<DropdownMenuItem
														key={reviewer._id}
														onSelect={() =>
															handleAddParticipant(event._id, reviewer._id)
														}
													>
														{reviewer.name}
													</DropdownMenuItem>
												))}
											</DropdownMenuSubContent>
										</DropdownMenuSub>
									) : null}
									{event.status === "scheduled" && canManageCurrentTeam ? (
										<DropdownMenuItem
											onSelect={() => setReschedulingId(event._id)}
										>
											<Clock />
											{t("events.editSchedule")}
										</DropdownMenuItem>
									) : null}
									{event.status === "started" ? (
										<DropdownMenuItem
											onSelect={() => handleComplete(event._id)}
										>
											<Check />
											{t("events.completeEvent")}
										</DropdownMenuItem>
									) : null}
									{event.status === "scheduled" ? (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => handleCancel(event._id)}
											>
												<Trash2 />
												{t("events.cancelEvent")}
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
						{creator && canManageCurrentTeam ? (
							<EditEventScheduleDialog
								eventId={event._id}
								eventTitle={event.title}
								scheduledAt={event.scheduledAt}
								open={reschedulingId === event._id}
								onOpenChange={(open) => {
									if (!open) setReschedulingId(null);
								}}
								onCloseAutoFocus={(focusEvent) => {
									focusEvent.preventDefault();
									document.getElementById(eventActionsId(event._id))?.focus();
								}}
							/>
						) : null}
					</div>
				}
			>
				<span className="font-medium text-foreground">{event.title}</span>
				<span
					className={cn(
						remaining > 0 &&
							remaining < COUNTDOWN_WINDOW_MS &&
							"font-mono tabular-nums text-foreground",
					)}
				>
					{whenLabel(event, remaining)}
				</span>
				{names.length > 0 ? (
					<span className="min-w-0 truncate">· {names.join(", ")}</span>
				) : null}
			</NoticeLine>
		);
	});
}
