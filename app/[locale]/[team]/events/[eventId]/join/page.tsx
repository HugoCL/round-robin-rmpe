"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
	Calendar,
	CheckCircle2,
	Clock,
	Loader2,
	UserCheck,
	Users,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function JoinEventPage() {
	const params = useParams<{ team: string; eventId: string }>();
	const teamSlug = params.team;
	const eventId = params.eventId as Id<"events">;
	const t = useTranslations();
	const locale = useLocale();
	const { user, isLoaded: userLoaded } = useUser();

	const [joinStatus, setJoinStatus] = useState<
		"idle" | "joining" | "success" | "error" | "already"
	>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	const eventWithTeam = useQuery(api.queries.getEventWithTeam, { eventId });
	const joinEventMutation = useMutation(api.mutations.joinEvent);

	const event = eventWithTeam?.event;
	const team = eventWithTeam?.team;

	// Auto-join when user is loaded and event is available
	useEffect(() => {
		const autoJoin = async () => {
			if (!userLoaded || !user || !event || joinStatus !== "idle") return;

			// Check if event is still active
			if (event.status === "cancelled" || event.status === "completed") {
				setJoinStatus("error");
				setErrorMessage(t("events.eventNoLongerActive"));
				return;
			}

			// Check if already participating
			const alreadyJoined = event.participants.some(
				(p) =>
					p.email.toLowerCase() ===
					user.primaryEmailAddress?.emailAddress?.toLowerCase(),
			);

			if (alreadyJoined) {
				setJoinStatus("already");
				return;
			}

			// Auto-join
			setJoinStatus("joining");
			try {
				const result = await joinEventMutation({
					eventId,
					participant: {
						email: user.primaryEmailAddress?.emailAddress || "",
						name: user.fullName || user.firstName || "Unknown",
					},
				});

				if (result.success) {
					setJoinStatus("success");
				} else if (result.alreadyJoined) {
					setJoinStatus("already");
				} else {
					setJoinStatus("error");
					setErrorMessage(result.error || t("events.joinFailed"));
				}
			} catch (error) {
				console.error("Error joining event:", error);
				setJoinStatus("error");
				setErrorMessage(t("events.joinFailed"));
			}
		};

		autoJoin();
	}, [userLoaded, user, event, eventId, joinEventMutation, joinStatus, t]);

	const formatDateTime = (timestamp: number) => {
		const date = new Date(timestamp);
		const dateStr = date.toLocaleDateString(locale, {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
		const timeStr = date.toLocaleTimeString(locale, {
			hour: "2-digit",
			minute: "2-digit",
		});
		return { dateStr, timeStr };
	};

	// Loading state
	if (!userLoaded || eventWithTeam === undefined) {
		return (
			<div className="container mx-auto py-10 flex items-center justify-center min-h-[50vh]">
				<Card className="w-full max-w-md">
					<CardContent className="flex flex-col items-center justify-center py-10">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						<p className="mt-4 text-muted-foreground">{t("common.loading")}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Not signed in
	if (!user) {
		return (
			<div className="container mx-auto py-10 flex items-center justify-center min-h-[50vh]">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle>{t("events.signInRequired")}</CardTitle>
						<CardDescription>{t("events.signInToJoin")}</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Link href={`/${locale}/sign-in`}>
							<Button>{t("common.signIn")}</Button>
						</Link>
					</CardFooter>
				</Card>
			</div>
		);
	}

	// Event not found
	if (!event || !team) {
		return (
			<div className="container mx-auto py-10 flex items-center justify-center min-h-[50vh]">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
						<CardTitle>{t("events.notFound")}</CardTitle>
						<CardDescription>{t("events.notFoundDescription")}</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Link href={`/${locale}/${teamSlug}`}>
							<Button variant="outline">{t("team.backHome")}</Button>
						</Link>
					</CardFooter>
				</Card>
			</div>
		);
	}

	const { dateStr, timeStr } = formatDateTime(event.scheduledAt);

	return (
		<div className="container mx-auto py-10 flex items-center justify-center min-h-[50vh]">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					{joinStatus === "joining" && (
						<Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
					)}
					{joinStatus === "success" && (
						<CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
					)}
					{joinStatus === "already" && (
						<UserCheck className="h-12 w-12 text-blue-500 mx-auto mb-2" />
					)}
					{joinStatus === "error" && (
						<XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
					)}
					{joinStatus === "idle" && (
						<Calendar className="h-12 w-12 text-primary mx-auto mb-2" />
					)}

					<CardTitle>
						{joinStatus === "joining" && t("events.joining")}
						{joinStatus === "success" && t("events.joinedSuccessfully")}
						{joinStatus === "already" && t("events.alreadyParticipating")}
						{joinStatus === "error" && t("common.error")}
						{joinStatus === "idle" && event.title}
					</CardTitle>

					<CardDescription>
						{joinStatus === "error" && errorMessage}
						{joinStatus !== "error" && event.title}
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{event.description && (
						<p className="text-sm text-muted-foreground text-center">
							{event.description}
						</p>
					)}

					<div className="flex flex-col items-center gap-2 text-sm">
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4 text-muted-foreground" />
							<span>{dateStr}</span>
						</div>
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<span>{timeStr}</span>
						</div>
						<div className="flex items-center gap-2">
							<Users className="h-4 w-4 text-muted-foreground" />
							<span>
								{event.participants.length} {t("events.participants")}
							</span>
						</div>
					</div>

					{event.participants.length > 0 && (
						<div className="flex flex-wrap justify-center gap-1 pt-2">
							{event.participants.map((p) => (
								<Badge key={p.email} variant="outline" className="text-xs">
									{p.name}
								</Badge>
							))}
						</div>
					)}
				</CardContent>

				<CardFooter className="justify-center">
					<Link href={`/${locale}/${teamSlug}`}>
						<Button variant="outline">{t("events.goToTeam")}</Button>
					</Link>
				</CardFooter>
			</Card>
		</div>
	);
}
