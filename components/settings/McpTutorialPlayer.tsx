"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const SCENE_MS = [3800, 4200, 5600, 4800] as const;
const TOTAL_MS = SCENE_MS.reduce((sum, value) => sum + value, 0);
const TICK_MS = 80;
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

const DEMO_COMMAND =
	'claude mcp add --transport http la-lista https://la-lista.vercel.app/api/mcp --header "Authorization: Bearer ll_live_••••"';

function formatTimecode(ms: number) {
	const totalSeconds = Math.min(TOTAL_MS, Math.max(0, ms)) / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sceneIndexForElapsed(elapsedMs: number) {
	let cursor = 0;
	for (let index = 0; index < SCENE_MS.length; index += 1) {
		cursor += SCENE_MS[index];
		if (elapsedMs < cursor) return index;
	}
	return SCENE_MS.length - 1;
}

function startMsForScene(index: number) {
	let cursor = 0;
	for (let scene = 0; scene < index; scene += 1) {
		cursor += SCENE_MS[scene];
	}
	return cursor;
}

function progressForScene(elapsedMs: number, index: number) {
	const start = startMsForScene(index);
	const duration = SCENE_MS[index] ?? 1;
	if (elapsedMs <= start) return 0;
	if (elapsedMs >= start + duration) return 1;
	return (elapsedMs - start) / duration;
}

function useTypedText(
	text: string,
	active: boolean,
	playing: boolean,
	durationMs: number,
) {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!active) {
			setCount(0);
			return;
		}

		if (!playing) return;

		const step = Math.max(16, durationMs / Math.max(text.length, 1));
		const id = window.setInterval(() => {
			setCount((current) => {
				if (current >= text.length) {
					window.clearInterval(id);
					return current;
				}
				return current + 1;
			});
		}, step);

		return () => window.clearInterval(id);
	}, [active, durationMs, playing, text]);

	return text.slice(0, count);
}

function SceneOpen({ compact }: { compact: boolean }) {
	const t = useTranslations("agentSetup");
	return (
		<div className="flex h-full flex-col justify-center gap-3">
			<div className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
				<p className="text-sm font-semibold tracking-tight">La Lista</p>
				<div className="flex items-center gap-1">
					<span className="hidden size-7 rounded-full bg-muted/80 sm:block" />
					<span className="ring-2 ring-primary/45 ring-offset-2 ring-offset-background inline-flex h-8 items-center rounded-full border border-primary/25 bg-primary/12 px-2.5 text-xs font-medium text-primary">
						MCP
					</span>
					<span className="size-7 rounded-full bg-muted/80" />
				</div>
			</div>
			{compact ? null : (
				<p className="text-xs text-muted-foreground">
					{t("tutorialSceneOpenHint")}
				</p>
			)}
		</div>
	);
}

function SceneToken({ compact }: { compact: boolean }) {
	const t = useTranslations("agentSetup");
	return (
		<div className="flex h-full flex-col justify-center gap-3">
			<div className="rounded-2xl border border-border/70 bg-background/80 px-3 py-3">
				<p className="text-xs font-medium">{t("generateTokenTitle")}</p>
				<div className="mt-3 flex items-center gap-2">
					<span className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground">
						{t("generateToken")}
					</span>
					<span className="font-mono text-[11px] text-muted-foreground">
						ll_live_8f3a…k2
					</span>
				</div>
			</div>
			{compact ? null : (
				<p className="text-xs text-muted-foreground">{t("tokenOnceHint")}</p>
			)}
		</div>
	);
}

function SceneCommand({
	compact,
	playing,
}: {
	compact: boolean;
	playing: boolean;
}) {
	const t = useTranslations("agentSetup");
	const typedCommand = useTypedText(DEMO_COMMAND, true, playing, 3600);
	const finished = typedCommand.length >= DEMO_COMMAND.length;
	return (
		<div className="flex h-full flex-col justify-center gap-2">
			<div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3">
				<p className="calm-kicker mb-2">{t("tutorialTerminalLabel")}</p>
				<pre className="overflow-hidden font-mono text-[11px] leading-5 text-foreground">
					<code>
						{typedCommand}
						<span className="ml-px inline-block h-3 w-1.5 translate-y-px bg-primary/80" />
					</code>
				</pre>
				{finished ? (
					<p className="mt-2 text-xs text-primary">
						{t("tutorialCommandSuccess")}
					</p>
				) : null}
			</div>
			{compact ? null : (
				<p className="text-xs text-muted-foreground">
					{t("tutorialSceneCommandHint")}
				</p>
			)}
		</div>
	);
}

function SceneAssign() {
	const t = useTranslations("agentSetup");
	return (
		<div className="flex h-full flex-col justify-center gap-2">
			<div className="ml-auto max-w-[90%] rounded-2xl bg-primary px-3 py-2 text-xs text-primary-foreground">
				{t("tutorialChatUser")}
			</div>
			<div className="max-w-[92%] rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-xs text-foreground">
				{t("tutorialChatAgent")}
			</div>
		</div>
	);
}

export function McpTutorialPlayer({
	compact = false,
	className,
}: {
	compact?: boolean;
	className?: string;
}) {
	const t = useTranslations("agentSetup");
	const prefersReducedMotion = usePrefersReducedMotion();
	const [playing, setPlaying] = useState(!compact);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [sceneNonce, setSceneNonce] = useState(0);
	const sceneIndex = sceneIndexForElapsed(elapsedMs);
	const captions = useMemo(
		() => [
			t("tutorialSceneOpenCaption"),
			t("tutorialSceneTokenCaption"),
			t("tutorialSceneCommandCaption"),
			t("tutorialSceneAssignCaption"),
		],
		[t],
	);
	const staticSteps = useMemo(
		() => [
			t("mcpInstallStepOne"),
			t("mcpInstallStepTwo"),
			t("mcpInstallStepThree"),
			t("tutorialSceneAssignCaption"),
		],
		[t],
	);

	useEffect(() => {
		if (prefersReducedMotion || !playing) return;
		const id = window.setInterval(() => {
			setElapsedMs((current) => {
				const next = current + TICK_MS;
				return next >= TOTAL_MS ? 0 : next;
			});
		}, TICK_MS);
		return () => window.clearInterval(id);
	}, [playing, prefersReducedMotion]);

	if (prefersReducedMotion) {
		return (
			<div className={cn("calm-subtle-panel p-4", className)}>
				<p className="calm-kicker">{t("tutorialTitle")}</p>
				<ol className="mt-3 space-y-2">
					{staticSteps.map((step, index) => (
						<li key={step} className="flex gap-3 text-sm">
							<span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[11px] font-semibold text-primary">
								{index + 1}
							</span>
							<span className="text-muted-foreground">{step}</span>
						</li>
					))}
				</ol>
			</div>
		);
	}

	return (
		<figure
			className={cn(
				"overflow-hidden rounded-2xl border border-border/70 bg-muted/28",
				className,
			)}
			aria-label={t("tutorialTitle")}
		>
			<div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
				<p className="calm-kicker">{t("tutorialTitle")}</p>
				<p className="font-mono text-[11px] text-muted-foreground">
					{formatTimecode(elapsedMs)} / {formatTimecode(TOTAL_MS)}
				</p>
			</div>
			<div
				className={cn(
					"relative bg-background/55 px-3 pb-14 pt-3",
					compact ? "min-h-[176px]" : "min-h-[222px]",
				)}
			>
				<AnimatePresence mode="wait">
					<motion.div
						key={sceneIndex}
						className="h-full"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.2, ease: MOTION_EASE }}
					>
						{sceneIndex === 0 ? <SceneOpen compact={compact} /> : null}
						{sceneIndex === 1 ? <SceneToken compact={compact} /> : null}
						{sceneIndex === 2 ? (
							<SceneCommand
								key={sceneNonce}
								compact={compact}
								playing={playing}
							/>
						) : null}
						{sceneIndex === 3 ? <SceneAssign /> : null}
					</motion.div>
				</AnimatePresence>
				{compact && !playing ? (
					<button
						type="button"
						className="absolute inset-0 z-10 flex items-center justify-center bg-background/20"
						onClick={() => setPlaying(true)}
						aria-label={t("tutorialPlay")}
					>
						<span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
							<Play className="ml-0.5 h-5 w-5" />
						</span>
					</button>
				) : null}
				<figcaption className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-background/88 px-3 py-2 text-xs text-foreground">
					{captions[sceneIndex]}
				</figcaption>
			</div>
			<div className="flex items-center gap-3 px-3 py-2">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={() => setPlaying((current) => !current)}
					aria-label={playing ? t("tutorialPause") : t("tutorialPlay")}
				>
					{playing ? <Pause /> : <Play />}
				</Button>
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					{SCENE_MS.map((duration, index) => {
						const progress = progressForScene(elapsedMs, index);
						return (
							<button
								key={duration}
								type="button"
								className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border/80"
								aria-label={captions[index]}
								aria-current={sceneIndex === index}
								onClick={() => {
									setElapsedMs(startMsForScene(index));
									setSceneNonce((current) => current + 1);
									setPlaying(true);
								}}
							>
								<span className="sr-only">{captions[index]}</span>
								<span
									className="block h-full rounded-full bg-primary"
									style={{ width: `${Math.round(progress * 100)}%` }}
								/>
							</button>
						);
					})}
				</div>
			</div>
		</figure>
	);
}
