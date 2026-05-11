"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	getLocalDateKeyYYYYMMDD,
	reviewerHasBirthdayToday,
} from "@/lib/reviewerAvailability";
import { cn } from "@/lib/utils";
import { usePRReview } from "./PRReviewContext";

function dismissStorageKey(teamSlug: string, dateKey: string) {
	return `birthday-celebration-dismissed:${teamSlug}:${dateKey}`;
}

const SPARK_KEYS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
] as const;

export function BirthdayCelebrationOverlay({
	teamSlug,
	teamTimezone,
}: {
	teamSlug: string;
	teamTimezone: string;
}) {
	const t = useTranslations("birthday");
	const { reviewers, userInfo } = usePRReview();
	const [mounted, setMounted] = useState(false);

	const dateKey = useMemo(
		() => getLocalDateKeyYYYYMMDD(Date.now(), teamTimezone),
		[teamTimezone],
	);

	const selfRow = useMemo(() => {
		if (!userInfo?.email) return null;
		return (
			reviewers.find(
				(r) => r.email.toLowerCase() === userInfo.email.toLowerCase(),
			) ?? null
		);
	}, [reviewers, userInfo?.email]);

	const isBirthday =
		selfRow !== null && reviewerHasBirthdayToday(selfRow, teamTimezone);

	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		setMounted(true);
		try {
			const v = localStorage.getItem(dismissStorageKey(teamSlug, dateKey));
			setDismissed(v === "1");
		} catch {
			setDismissed(false);
		}
	}, [teamSlug, dateKey]);

	const visible = mounted && isBirthday && !dismissed;

	const onDismiss = () => {
		try {
			localStorage.setItem(dismissStorageKey(teamSlug, dateKey), "1");
		} catch {
			/* ignore */
		}
		setDismissed(true);
	};

	return (
		<AnimatePresence>
			{visible && selfRow ? (
				<motion.div
					className={cn(
						"pointer-events-none fixed inset-0 z-[60] flex items-center justify-center",
						"bg-gradient-to-b from-fuchsia-500/15 via-transparent to-violet-500/10",
					)}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.35 }}
				>
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						aria-hidden
					>
						{SPARK_KEYS.map((sparkId, i) => (
							<motion.span
								key={sparkId}
								className="absolute text-2xl opacity-70"
								style={{
									left: `${(i * 53) % 100}%`,
									top: `${(i * 37) % 100}%`,
								}}
								initial={{ y: -40, opacity: 0, rotate: 0 }}
								animate={{
									y: [0, 24, 0],
									opacity: [0, 1, 0.85],
									rotate: [0, 12, -8, 0],
								}}
								transition={{
									duration: 4 + (i % 5) * 0.4,
									repeat: Number.POSITIVE_INFINITY,
									delay: i * 0.08,
									ease: "easeInOut",
								}}
							>
								{i % 3 === 0 ? "🎉" : i % 3 === 1 ? "✨" : "🎈"}
							</motion.span>
						))}
					</div>

					<motion.div
						className="pointer-events-auto relative mx-4 w-full max-w-md rounded-2xl border border-fuchsia-500/30 bg-background/95 p-6 text-center shadow-2xl shadow-fuchsia-500/10 backdrop-blur-md dark:border-fuchsia-400/25"
						initial={{ scale: 0.92, y: 16, opacity: 0 }}
						animate={{ scale: 1, y: 0, opacity: 1 }}
						exit={{ scale: 0.95, opacity: 0 }}
						transition={{ type: "spring", stiffness: 320, damping: 26 }}
					>
						<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
							<Sparkles className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-300" />
						</div>
						<h2 className="font-semibold text-xl tracking-tight">
							{t("celebrationTitle", { name: selfRow.name })}
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							{t("celebrationSubtitle")}
						</p>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="mt-5"
							onClick={onDismiss}
						>
							{t("dismissCelebrate")}
						</Button>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
