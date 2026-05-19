"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
	const [confettiParticles, setConfettiParticles] = useState<
		{
			id: number;
			x: number;
			y: number;
			color: string;
			scale: number;
			rotate: number;
		}[]
	>([]);
	const [hasFiredConfetti, setHasFiredConfetti] = useState(false);

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

	useEffect(() => {
		if (visible && !hasFiredConfetti) {
			setHasFiredConfetti(true);
			const colors = [
				"#f59e0b",
				"#3b82f6",
				"#10b981",
				"#ef4444",
				"#8b5cf6",
				"#ec4899",
			];
			const particles = Array.from({ length: 65 }).map((_, i) => ({
				id: i,
				x: Math.random() * 260 - 130, // horizontal spread
				y: Math.random() * -180 - 60, // initial upward pop
				color: colors[i % colors.length],
				scale: Math.random() * 0.7 + 0.3,
				rotate: Math.random() * 360,
			}));
			setConfettiParticles(particles);

			const timer = setTimeout(() => {
				setConfettiParticles([]);
			}, 3600);
			return () => clearTimeout(timer);
		}
	}, [visible, hasFiredConfetti]);

	const onDismiss = () => {
		try {
			localStorage.setItem(dismissStorageKey(teamSlug, dateKey), "1");
		} catch {
			/* ignore */
		}
		setDismissed(true);
	};

	if (!mounted) return null;

	const overlayContent = (
		<AnimatePresence>
			{visible && selfRow ? (
				<motion.div
					className={cn(
						"fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs pointer-events-auto",
					)}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.25 }}
				>
					{/* Confetti Particle Burst */}
					{confettiParticles.map((p) => (
						<motion.div
							key={p.id}
							className="absolute pointer-events-none rounded-xs"
							style={{
								width: "8px",
								height: "14px",
								backgroundColor: p.color,
								left: "50%",
								top: "50%",
							}}
							initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
							animate={{
								x: p.x * 2.5,
								y: [p.y, p.y + 80, p.y + 400],
								scale: p.scale,
								rotate: p.rotate + 1080,
								opacity: [1, 1, 0],
							}}
							transition={{
								duration: 3,
								ease: "easeOut",
							}}
						/>
					))}
					<motion.div
						className="relative w-full max-w-sm rounded-3xl border border-amber-500/20 bg-background p-6 text-center shadow-2xl shadow-amber-500/[0.04] dark:shadow-amber-500/[0.02]"
						initial={{ scale: 0.95, y: 10, opacity: 0 }}
						animate={{ scale: 1, y: 0, opacity: 1 }}
						exit={{ scale: 0.95, y: 10, opacity: 0 }}
						transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
					>
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
							<Sparkles className="h-5 w-5" />
						</div>

						<h2 className="font-semibold text-lg tracking-tight font-display text-foreground">
							{t("celebrationTitle", { name: selfRow.name })}
						</h2>

						<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
							{t("celebrationSubtitle")}
						</p>

						<Button
							type="button"
							variant="default"
							size="lg"
							className="mt-6 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
							onClick={onDismiss}
						>
							{t("dismissCelebrate")}
						</Button>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(overlayContent, document.body);
}
