"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Calendar,
	Clock,
	Trash2,
	UserCheck,
	UserMinus,
	Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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

export function ActiveEventsList() {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug, userInfo } = usePRReview();

	const events = useQuery(
		api.queries.getActiveEvents,
		teamSlug ? { teamSlug } : "skip",
	);

	const joinEventMutation = useMutation(api.mutations.joinEvent);
	const leaveEventMutation = useMutation(api.mutations.leaveEvent);
	const cancelEventMutation = useMutation(api.mutations.cancelEvent);

	if (!events || events.length === 0) {
		return null;
	}

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

	const isParticipating = (event: (typeof events)[0]) => {
		return event.participants.some(
			(p) => p.email.toLowerCase() === userInfo?.email?.toLowerCase(),
		);
	};

	const isCreator = (event: (typeof events)[0]) => {
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

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-lg flex items-center gap-2">
					<Calendar className="h-5 w-5" />
					{t("events.upcomingEvents")}
				</CardTitle>
				<CardDescription>{t("events.upcomingDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{events.map((event) => {
					const { dateStr, timeStr } = formatDateTime(event.scheduledAt);
					const participating = isParticipating(event);
					const creator = isCreator(event);
					const isPast = event.scheduledAt < Date.now();

					return (
						<div
							key={event._id}
							className="border rounded-lg p-3 space-y-2 bg-card"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h4 className="font-medium flex items-center gap-2">
										{event.title}
										{event.status === "started" && (
											<Badge variant="default" className="text-xs">
												{t("events.inProgress")}
											</Badge>
										)}
										{isPast && event.status === "scheduled" && (
											<Badge variant="secondary" className="text-xs">
												{t("events.starting")}
											</Badge>
										)}
									</h4>
									{event.description && (
										<p className="text-sm text-muted-foreground mt-1">
											{event.description}
										</p>
									)}
								</div>
								{creator && event.status === "scheduled" && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
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

							<div className="flex items-center gap-4 text-sm text-muted-foreground">
								<span className="flex items-center gap-1">
									<Calendar className="h-3.5 w-3.5" />
									{dateStr}
								</span>
								<span className="flex items-center gap-1">
									<Clock className="h-3.5 w-3.5" />
									{timeStr}
								</span>
								<span className="flex items-center gap-1">
									<Users className="h-3.5 w-3.5" />
									{event.participants.length}
								</span>
							</div>

							{event.participants.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{event.participants.map((p) => (
										<Badge key={p.email} variant="outline" className="text-xs">
											{p.name}
										</Badge>
									))}
								</div>
							)}

							{event.status === "scheduled" && (
								<div className="flex gap-2 pt-1">
									{participating ? (
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
									)}
								</div>
							)}
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
