"use client";

import { formatDistanceToNow } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Check, CheckSquare2, ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Id } from "@/convex/_generated/dataModel";
import { useMyAssignments } from "@/hooks/useMyAssignments";

export function MyAssignmentsPanel() {
	const t = useTranslations();
	const { assignedToMe, iAssigned, complete, loading } = useMyAssignments();
	const [processing, setProcessing] = useState<string | null>(null);
	const locale = useLocale();
	const dateLocale = locale.startsWith("es") ? es : enUS;

	function formatTime(ts?: number) {
		if (!ts) return "";
		try {
			return formatDistanceToNow(new Date(ts), {
				addSuffix: true,
				locale: dateLocale,
			});
		} catch {
			return "";
		}
	}

	if (loading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
			</div>
		);
	}

	return (
		<div className="grid md:grid-cols-2 gap-4">
			{/* Assigned To Me */}
			<Card className="h-full flex flex-col">
				<CardHeader className="flex-shrink-0 flex flex-row items-start justify-between space-y-0 space-x-3">
					<CardTitle>{t("pr.assignedToMe")}</CardTitle>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 mt-1"
						title={t("pr.markAllApproved", {
							defaultValue: locale.startsWith("es")
								? "Marcar todas"
								: "Mark all",
						})}
						disabled={
							assignedToMe.length === 0 || processing === "__bulk_assignedToMe"
						}
						onClick={async () => {
							if (assignedToMe.length === 0) return;
							if (
								!confirm(
									locale.startsWith("es")
										? "¿Marcar todas como completadas?"
										: "Mark all as completed?",
								)
							)
								return;
							setProcessing("__bulk_assignedToMe");
							try {
								for (const a of assignedToMe) {
									try {
										await complete({
											id: a._id as Id<"prAssignments">,
											reviewerId: a.assigneeId,
										});
									} catch (e) {
										console.warn("Failed to complete assignment", a._id, e);
									}
								}
							} finally {
								setProcessing(null);
							}
						}}
					>
						<CheckSquare2 className="h-4 w-4" />
					</Button>
				</CardHeader>
				<CardContent className="flex-1 overflow-hidden">
					{assignedToMe.length === 0 ? (
						<div className="text-center p-4 border rounded-lg bg-muted h-full flex items-center justify-center">
							<p className="text-sm text-muted-foreground">{t("pr.none")}</p>
						</div>
					) : (
						<div className="space-y-3 h-full overflow-y-auto pr-1">
							{assignedToMe.map((a) => {
								return (
									<div
										key={a._id}
										className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
									>
										<div className="flex-1 min-w-0">
											<p className="font-semibold text-sm md:text-base break-all">
												{a.assignerName || t("pr.unknownUser")}
											</p>
											<p className="text-xs mt-1 break-all">
												{a.prUrl ? (
													<a
														href={a.prUrl}
														target="_blank"
														rel="noreferrer noopener"
														aria-label={t("common.viewPR")}
														className="inline-flex items-center gap-1 text-primary hover:underline"
													>
														<span className="truncate max-w-[220px] md:max-w-[260px] inline-block align-middle">
															{a.prUrl}
														</span>
														<ExternalLink className="h-3 w-3" />
													</a>
												) : (
													<span className="text-muted-foreground">
														{t("pr.noPrLink")}
													</span>
												)}
											</p>
											<p className="text-[11px] text-muted-foreground mt-1">
												{formatTime(a.createdAt)}
											</p>
										</div>
										<div className="flex flex-col items-end gap-2 ml-3">
											<Badge className="bg-amber-50 text-amber-700 border-amber-200">
												{t("pr.statusPending")}
											</Badge>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												title={t("pr.reviewedApproved")}
												disabled={processing === a._id}
												onClick={async () => {
													setProcessing(a._id);
													try {
														await complete({
															id: a._id as Id<"prAssignments">,
															reviewerId: a.assigneeId,
														});
													} finally {
														setProcessing(null);
													}
												}}
											>
												<Check className="h-4 w-4" />
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
			{/* I Assigned */}
			<Card className="h-full flex flex-col">
				<CardHeader className="flex-shrink-0 flex flex-row items-start justify-between space-y-0 space-x-3">
					<CardTitle>{t("pr.iAssigned")}</CardTitle>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 mt-1"
						title={t("pr.markAllApproved", {
							defaultValue: locale.startsWith("es")
								? "Marcar todas"
								: "Mark all",
						})}
						disabled={
							iAssigned.length === 0 || processing === "__bulk_iAssigned"
						}
						onClick={async () => {
							if (iAssigned.length === 0) return;
							if (
								!confirm(
									locale.startsWith("es")
										? "¿Marcar todas como completadas?"
										: "Mark all as completed?",
								)
							)
								return;
							setProcessing("__bulk_iAssigned");
							try {
								for (const a of iAssigned) {
									try {
										await complete({
											id: a._id as Id<"prAssignments">,
											reviewerId: a.assignerId,
										});
									} catch (e) {
										console.warn("Failed to complete assignment", a._id, e);
									}
								}
							} finally {
								setProcessing(null);
							}
						}}
					>
						<CheckSquare2 className="h-4 w-4" />
					</Button>
				</CardHeader>
				<CardContent className="flex-1 overflow-hidden">
					{iAssigned.length === 0 ? (
						<div className="text-center p-4 border rounded-lg bg-muted h-full flex items-center justify-center">
							<p className="text-sm text-muted-foreground">{t("pr.none")}</p>
						</div>
					) : (
						<div className="space-y-3 h-full overflow-y-auto pr-1">
							{iAssigned.map((a) => {
								return (
									<div
										key={a._id}
										className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
									>
										<div className="flex-1 min-w-0">
											<p className="font-semibold text-sm md:text-base break-all">
												{a.assigneeName || t("pr.unknownUser")}
											</p>
											<p className="text-xs mt-1 break-all">
												{a.prUrl ? (
													<a
														href={a.prUrl}
														target="_blank"
														rel="noreferrer noopener"
														aria-label={t("common.viewPR")}
														className="inline-flex items-center gap-1 text-primary hover:underline"
													>
														<span className="truncate max-w-[220px] md:max-w-[260px] inline-block align-middle">
															{a.prUrl}
														</span>
														<ExternalLink className="h-3 w-3" />
													</a>
												) : (
													<span className="text-muted-foreground">
														{t("pr.noPrLink")}
													</span>
												)}
											</p>
											<p className="text-[11px] text-muted-foreground mt-1">
												{formatTime(a.createdAt)}
											</p>
										</div>
										<div className="flex flex-col items-end gap-2 ml-3">
											<Badge className="bg-amber-50 text-amber-700 border-amber-200">
												{t("pr.statusPending")}
											</Badge>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												title={t("pr.reviewedApproved")}
												disabled={processing === a._id}
												onClick={async () => {
													setProcessing(a._id);
													try {
														await complete({
															id: a._id as Id<"prAssignments">,
															reviewerId: a.assignerId,
														});
													} finally {
														setProcessing(null);
													}
												}}
											>
												<Check className="h-4 w-4" />
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
