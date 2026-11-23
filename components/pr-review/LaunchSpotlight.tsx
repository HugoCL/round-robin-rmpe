"use client";

import { useMutation, useQuery } from "convex/react";
import { Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { api } from "@/convex/_generated/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
	changelogEntries,
	LAUNCH_VIDEO_SIZE,
	pickLaunchSpotlight,
} from "@/lib/changelog";
import { useWidgetLayout } from "./widgets/WidgetLayoutContext";

function localDateKey() {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * A big launch, shown once to each person when they open the list, and gone
 * for good once dismissed. The launch stays in the changelog.
 *
 * It never covers the assignment card: from 1280px, where the first lane ends
 * before the corner does, it floats at the bottom right. On a narrower screen
 * it sits in the page under the card.
 */
export function LaunchSpotlight() {
	const t = useTranslations("launch");
	const preferences = useQuery(api.queries.getMyUserPreferences, {});
	const markSeen = useMutation(api.mutations.updateMyUserPreferences);
	const { editing, setEditing } = useWidgetLayout();
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const titleId = useId();
	const [today] = useState(localDateKey);
	// Covers the gap between the click and the query catching up.
	const [dismissed, setDismissed] = useState<string[]>([]);
	const [videoOpen, setVideoOpen] = useState(false);

	// Nothing until the server says what this person has seen, so a dismissed
	// launch never flashes on load.
	if (!preferences?.isAuthenticated) return null;
	const entry = pickLaunchSpotlight(
		changelogEntries,
		[...preferences.seenLaunches, ...dismissed],
		today,
	);
	if (!entry) return null;
	const { id, summary } = entry.spotlight;

	const dismiss = () => {
		setDismissed((current) => [...current, id]);
		void markSeen({ seenLaunch: id }).catch((error) => console.error(error));
	};
	// What the launch invites the person to do, when it is one click away.
	const action =
		id === "custom-view"
			? { label: t("customizeView"), run: () => setEditing(true) }
			: null;

	return (
		<>
			{/* While customizing, the page belongs to the widgets. */}
			{editing ? null : (
				<aside
					data-launch-spotlight={id}
					aria-labelledby={titleId}
					className="page-enter-soft z-30 flex gap-1 rounded-3xl border border-border/70 bg-popover p-3 text-popover-foreground [animation-delay:600ms] max-xl:mb-6 xl:fixed xl:right-4 xl:bottom-4 xl:w-[31rem] xl:shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] print:hidden"
				>
					{entry.video ? (
						<button
							type="button"
							onClick={() => setVideoOpen(true)}
							aria-label={t("watchTitled", { title: entry.title })}
							className="group relative w-40 shrink-0 overflow-hidden rounded-xl outline-1 -outline-offset-1 outline-black/10 transition-[scale] duration-150 active:scale-[0.96] dark:outline-white/10 max-sm:hidden"
						>
							{/* Cropped to its top-left corner, and taller than the frame so the caption strip falls outside. */}
							{/* biome-ignore lint/performance/noImgElement: a 45 KB local poster, shown at one size */}
							<img
								src={entry.video.poster}
								alt=""
								width={LAUNCH_VIDEO_SIZE.width / 2}
								height={LAUNCH_VIDEO_SIZE.height / 2}
								className="absolute inset-x-0 top-0 h-[112%] w-full object-cover object-left-top"
							/>
							<span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
								{t("new")}
							</span>
							<span className="absolute inset-0 grid place-items-center transition-colors duration-150 group-hover:bg-foreground/8">
								<span className="grid size-10 place-items-center rounded-full bg-background/92 text-foreground shadow-[0_6px_20px_-6px_rgba(15,23,42,0.5)]">
									<Play
										className="size-4 translate-x-px fill-current"
										aria-hidden="true"
									/>
								</span>
							</span>
						</button>
					) : null}
					<div className="min-w-0 flex-1 px-2 py-1">
						<div className="flex items-start gap-2">
							<h2
								id={titleId}
								className="min-w-0 flex-1 pt-0.5 text-base font-semibold text-balance"
							>
								{entry.title}
							</h2>
							<IconActionButton
								label={t("dismiss")}
								className="-mt-1.5 -mr-1.5"
								onClick={dismiss}
							>
								<X />
							</IconActionButton>
						</div>
						<p className="mt-1 text-sm text-pretty text-muted-foreground">
							{summary}
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-1.5">
							{action ? (
								<Button
									size="sm"
									onClick={() => {
										dismiss();
										action.run();
									}}
								>
									{action.label}
								</Button>
							) : null}
							{entry.video ? (
								<Button
									size="sm"
									variant={action ? "outline" : "default"}
									className={action ? "sm:hidden" : undefined}
									onClick={() => setVideoOpen(true)}
								>
									<Play data-icon="inline-start" />
									{t("watch")}
								</Button>
							) : null}
						</div>
					</div>
				</aside>
			)}
			{entry.video ? (
				<Dialog open={videoOpen} onOpenChange={setVideoOpen}>
					<DialogContent className="sm:max-w-4xl">
						<DialogHeader>
							<DialogTitle>{entry.title}</DialogTitle>
							<DialogDescription>{summary}</DialogDescription>
						</DialogHeader>
						{/* Captions are burned into the picture and there is no sound. */}
						<video
							controls
							muted
							playsInline
							autoPlay={!reducedMotion}
							poster={entry.video.poster}
							aria-label={entry.title}
							{...LAUNCH_VIDEO_SIZE}
							className="h-auto w-full rounded-xl border border-border/60"
						>
							<source src={entry.video.src} type="video/mp4" />
						</video>
					</DialogContent>
				</Dialog>
			) : null}
		</>
	);
}
