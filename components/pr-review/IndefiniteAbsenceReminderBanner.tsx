"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import { usePRReview } from "./PRReviewContext";

export function IndefiniteAbsenceReminderBanner() {
	const t = useTranslations();
	const { reviewers, userInfo, onMarkAvailable, onSetExcludedFromReviewPool } =
		usePRReview();

	if (!userInfo?.email) return null;

	const row = reviewers.find(
		(r) => r.email.toLowerCase() === userInfo.email.toLowerCase(),
	);
	if (!row) return null;
	if (
		!row.isAbsent ||
		row.absentUntil != null ||
		row.excludedFromReviewPool === true
	) {
		return null;
	}

	const id = row._id as Id<"reviewers">;

	return (
		<Alert className="border-amber-500/40 bg-amber-500/5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50">
			<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
			<AlertTitle>{t("absent.indefiniteReminderTitle")}</AlertTitle>
			<AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<p className="text-sm text-amber-900/90 dark:text-amber-50/90">
					{t("absent.indefiniteReminderDescription")}
				</p>
				<TooltipProvider delayDuration={300}>
					<div className="flex shrink-0 flex-wrap gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									size="sm"
									className="w-fit"
									onClick={() => void onMarkAvailable(id)}
								>
									{t("absent.markAvailableCta")}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="max-w-xs text-xs">
								{t("absent.markAvailableCtaTooltip")}
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="w-fit border-amber-600/50 bg-background/80 dark:border-amber-400/40"
									onClick={() => void onSetExcludedFromReviewPool(id, true)}
								>
									{t("absent.notAReviewerCta")}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="max-w-xs text-xs">
								{t("absent.notAReviewerCtaTooltip")}
							</TooltipContent>
						</Tooltip>
					</div>
				</TooltipProvider>
			</AlertDescription>
		</Alert>
	);
}
