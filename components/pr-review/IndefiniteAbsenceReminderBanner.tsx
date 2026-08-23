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
import { isIncludedInTagRotations } from "@/lib/reviewerEligibility";
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
		(row.excludedFromReviewPool === true && !isIncludedInTagRotations(row))
	) {
		return null;
	}

	const id = row._id as Id<"reviewers">;

	return (
		<Alert
			data-notice
			className="rounded-xl border-amber-500/30 bg-amber-500/[0.05] px-3 py-2.5 text-foreground shadow-none sm:px-4"
		>
			<AlertTriangle className="text-amber-600 dark:text-amber-400" />
			<AlertTitle>{t("absent.indefiniteReminderTitle")}</AlertTitle>
			<AlertDescription className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<p className="line-clamp-2 text-xs sm:text-sm">
					{t("absent.indefiniteReminderDescription")}
				</p>
				<TooltipProvider delayDuration={300}>
					<div className="flex shrink-0 flex-wrap gap-1.5">
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
						{row.excludedFromReviewPool !== true && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="w-fit bg-background/70"
										onClick={() => void onSetExcludedFromReviewPool(id, true)}
									>
										{t("absent.notAReviewerCta")}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top" className="max-w-xs text-xs">
									{t("absent.notAReviewerCtaTooltip")}
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				</TooltipProvider>
			</AlertDescription>
		</Alert>
	);
}
