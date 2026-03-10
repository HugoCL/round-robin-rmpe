"use client";

import { useQuery } from "convex/react";
import { ArrowRight, RadioTower } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type MatchMediaWithLegacySupport = MediaQueryList & {
	addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
	removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		) as MatchMediaWithLegacySupport;
		const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

		updatePreference();
		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", updatePreference);
			return () => mediaQuery.removeEventListener("change", updatePreference);
		}

		mediaQuery.addListener?.(updatePreference);
		return () => mediaQuery.removeListener?.(updatePreference);
	}, []);

	return prefersReducedMotion;
}

export function LandingAssignmentTicker() {
	const t = useTranslations();
	const tickerItems = useQuery(api.queries.getLandingAssignmentTicker);
	const prefersReducedMotion = usePrefersReducedMotion();
	const previousNewestIdRef = useRef<string | null>(null);
	const resumeTimeoutRef = useRef<number | null>(null);
	const [isPausedForUpdate, setIsPausedForUpdate] = useState(false);
	const [highlightedId, setHighlightedId] = useState<string | null>(null);
	const [announcement, setAnnouncement] = useState("");

	const items = tickerItems ?? [];
	const highlightedItem = highlightedId
		? (items.find((item) => item.id === highlightedId) ?? null)
		: null;
	const animationDuration = useMemo(() => {
		const seconds = Math.max(items.length * 5, 24);
		return `${seconds}s`;
	}, [items.length]);

	useEffect(() => {
		return () => {
			if (resumeTimeoutRef.current !== null) {
				window.clearTimeout(resumeTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const newestItem = items[0];
		if (!newestItem) {
			previousNewestIdRef.current = null;
			setAnnouncement("");
			return;
		}

		if (previousNewestIdRef.current === null) {
			previousNewestIdRef.current = newestItem.id;
			return;
		}

		if (previousNewestIdRef.current === newestItem.id) {
			return;
		}

		previousNewestIdRef.current = newestItem.id;
		setHighlightedId(newestItem.id);
		setAnnouncement(
			t("team.switcher.tickerAnnouncement", {
				teamName: newestItem.teamName,
				assignerName: newestItem.assignerName,
				assigneeName: newestItem.assigneeName,
			}),
		);

		if (prefersReducedMotion) {
			setIsPausedForUpdate(false);
			if (resumeTimeoutRef.current !== null) {
				window.clearTimeout(resumeTimeoutRef.current);
			}
			resumeTimeoutRef.current = window.setTimeout(() => {
				setHighlightedId(null);
				resumeTimeoutRef.current = null;
			}, 1600);
			return;
		}

		setIsPausedForUpdate(true);
		if (resumeTimeoutRef.current !== null) {
			window.clearTimeout(resumeTimeoutRef.current);
		}
		resumeTimeoutRef.current = window.setTimeout(() => {
			setHighlightedId(null);
			setIsPausedForUpdate(false);
			resumeTimeoutRef.current = null;
		}, 2200);
	}, [items, prefersReducedMotion, t]);

	if (tickerItems === undefined) {
		return (
			<div className="mt-8 border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
				{t("common.loading")}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<section
				aria-label={t("team.switcher.tickerAriaLabel")}
				className="mt-8 border border-dashed border-border/70 bg-background/70 px-4 py-4"
			>
				<div className="flex items-center gap-3 text-sm text-muted-foreground">
					<RadioTower className="h-4 w-4 shrink-0 text-primary/70" />
					<div>
						<p className="font-medium text-foreground">
							{t("team.switcher.tickerTitle")}
						</p>
						<p>{t("team.switcher.tickerEmpty")}</p>
					</div>
				</div>
			</section>
		);
	}

	const renderItems = (clone = false) => (
		<div aria-hidden={clone} className="flex shrink-0 items-center gap-3 pr-3">
			{items.map((item) => {
				const isHighlighted = !clone && highlightedId === item.id;

				return (
					<div
						key={`${clone ? "clone" : "primary"}-${item.id}`}
						className={cn(
							"relative isolate flex shrink-0 items-center overflow-visible rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm shadow-[0_10px_30px_-24px_rgba(15,23,42,0.65)] transition-colors duration-300",
							isHighlighted &&
								"border-primary/60 bg-primary/8 text-foreground shadow-[0_18px_40px_-26px_rgba(37,99,235,0.85)]",
						)}
					>
						<span className="relative flex items-center gap-2 whitespace-nowrap">
							<span className="font-semibold">{item.teamName}</span>
							<span className="text-muted-foreground/70">-</span>
							{item.prNumber ? (
								<>
									<span className="font-medium text-primary/85">
										PR #{item.prNumber}
									</span>
									<span className="text-muted-foreground/70">-</span>
								</>
							) : null}
							<span>{item.assignerName}</span>
							<ArrowRight
								aria-hidden
								className="h-3.5 w-3.5 shrink-0 text-primary/75"
							/>
							<span className="font-medium">{item.assigneeName}</span>
						</span>
					</div>
				);
			})}
		</div>
	);

	return (
		<section
			aria-label={t("team.switcher.tickerAriaLabel")}
			className="mt-8 space-y-3"
		>
			<div className="flex items-center gap-2 text-sm font-medium text-foreground">
				<RadioTower className="h-4 w-4 text-primary" />
				<span>{t("team.switcher.tickerTitle")}</span>
			</div>

			<div
				className="landing-ticker relative h-20 overflow-hidden bg-background/80"
				data-paused={isPausedForUpdate}
				data-updating={highlightedItem ? "true" : "false"}
			>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background via-background/85 to-transparent"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background via-background/85 to-transparent"
				/>

				{highlightedItem ? (
					<div className="landing-ticker-overlay pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden px-4">
						<span
							aria-hidden
							className="landing-ticker-surface-wave landing-ticker-surface-wave-delay"
						/>
						<span aria-hidden className="landing-ticker-surface-wave" />
						<div className="landing-ticker-surface-flash absolute inset-0" />
						<div className="relative flex max-w-full flex-col items-center gap-2 text-center">
							<span className="rounded-full border border-primary/45 bg-background/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary shadow-[0_12px_30px_-18px_rgba(37,99,235,0.85)]">
								{t("team.switcher.tickerNewAssignment")}
							</span>
							<p className="max-w-3xl text-sm font-medium leading-tight text-foreground md:text-base">
								<span>{highlightedItem.teamName}</span>
								<span className="mx-2 text-muted-foreground/70">-</span>
								{highlightedItem.prNumber ? (
									<>
										<span className="font-medium text-primary/85">
											PR #{highlightedItem.prNumber}
										</span>
										<span className="mx-2 text-muted-foreground/70">-</span>
									</>
								) : null}
								<span>{highlightedItem.assignerName}</span>
								<ArrowRight
									aria-hidden
									className="mx-2 inline-block h-4 w-4 align-[-0.125em] text-primary/80"
								/>
								<span>{highlightedItem.assigneeName}</span>
							</p>
						</div>
					</div>
				) : null}

				{prefersReducedMotion ? (
					<div className="flex h-full items-center overflow-x-auto px-3">
						<div className="flex min-w-max items-center gap-3">
							{renderItems()}
						</div>
					</div>
				) : (
					<div className="flex h-full items-center overflow-hidden">
						<div
							className="landing-ticker-track flex w-max items-center"
							style={
								{
									"--ticker-duration": animationDuration,
								} as CSSProperties
							}
						>
							{renderItems()}
							{renderItems(true)}
						</div>
					</div>
				)}

				<div aria-live="polite" className="sr-only">
					{announcement}
				</div>
			</div>
		</section>
	);
}
