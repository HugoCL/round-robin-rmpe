"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useTeamWeeklyPrCount } from "@/hooks/useTeamWeeklyPrCount";
import { cn } from "@/lib/utils";

function RollingDigit({
	digit,
	reducedMotion,
}: {
	digit: number;
	reducedMotion: boolean;
}) {
	const [offset, setOffset] = useState(digit);

	useEffect(() => {
		if (reducedMotion) {
			setOffset(digit);
			return;
		}

		setOffset((previousOffset) => {
			const previousDigit = ((previousOffset % 10) + 10) % 10;
			const delta = (digit - previousDigit + 10) % 10;
			return previousOffset + delta;
		});
	}, [digit, reducedMotion]);

	const digitStack = useMemo(() => {
		const repetitions = Math.max(2, Math.floor(offset / 10) + 2);
		return Array.from({ length: repetitions * 10 }, (_, step) => ({
			key: `digit-${step}`,
			value: step % 10,
		}));
	}, [offset]);

	return (
		<span className="inline-flex h-[1.15em] w-[1ch] overflow-hidden align-baseline">
			<span
				className={cn(
					"flex flex-col leading-none tabular-nums",
					!reducedMotion && "transition-transform duration-300 ease-out",
				)}
				style={{ transform: `translateY(calc(-${offset} * 1.1em))` }}
			>
				{digitStack.map((item) => (
					<span key={item.key} className="h-[1.1em] leading-[1.1em]">
						{item.value}
					</span>
				))}
			</span>
		</span>
	);
}

export function TeamWeeklyPRCounter({ teamSlug }: { teamSlug?: string }) {
	const t = useTranslations();
	const locale = useLocale();
	const [reducedMotion, setReducedMotion] = useState(false);
	const { count, isLoading } = useTeamWeeklyPrCount(teamSlug);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const updateMotionPreference = () => {
			setReducedMotion(mediaQuery.matches);
		};

		updateMotionPreference();
		mediaQuery.addEventListener("change", updateMotionPreference);

		return () => {
			mediaQuery.removeEventListener("change", updateMotionPreference);
		};
	}, []);

	const displayCount = isLoading ? 0 : count;
	const formattedCount = new Intl.NumberFormat(locale).format(displayCount);
	const formattedCharacters = useMemo(
		() =>
			Array.from(formattedCount, (character, slot) => ({
				character,
				slotKey: `slot-${slot}`,
			})),
		[formattedCount],
	);

	if (!teamSlug) {
		return null;
	}

	return (
		<Badge
			variant="secondary"
			className="gap-1.5 text-xs font-medium text-muted-foreground"
			aria-live="polite"
			aria-label={t("pr.teamPrsThisWeekAria", {
				count: formattedCount,
			})}
		>
			<span className="hidden sm:inline">{t("pr.teamPrsThisWeek")}</span>
			<span className="font-semibold text-foreground tabular-nums" aria-hidden>
				{formattedCharacters.map((item) => {
					const character = item.character;
					if (/\d/.test(character)) {
						return (
							<RollingDigit
								key={`digit-${item.slotKey}`}
								digit={Number(character)}
								reducedMotion={reducedMotion}
							/>
						);
					}

					return (
						<span
							key={`sep-${item.slotKey}`}
							className="inline-block leading-none"
						>
							{character}
						</span>
					);
				})}
			</span>
		</Badge>
	);
}
