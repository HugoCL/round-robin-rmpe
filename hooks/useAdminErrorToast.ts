"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { classifyConvexError, extractConvexMessage } from "@/lib/convexErrors";

/**
 * One place that turns a failed mutation into a useful toast.
 *
 * Without this the authorization sentinels reach the user as a raw Convex
 * stack trace, which hides the actionable part ("ask a team owner").
 */
export function useAdminErrorToast() {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();

	return useCallback(
		(error: unknown) => {
			console.error(error);
			const code = classifyConvexError(error);
			toast({
				title: tCommon("common.error"),
				description: code ? t(`errors.${code}`) : extractConvexMessage(error),
				variant: "destructive",
			});
		},
		[t, tCommon, toast],
	);
}
