"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useRotatingIndex } from "@/hooks/useRotatingIndex";
import {
	MCP_USAGE_EXAMPLE_IDS,
	MCP_USAGE_ROTATE_MS,
	MCP_USAGE_TUTORIAL_ROTATE_MS,
	type McpUsageExampleId,
} from "@/lib/agent-mcp-usage-examples";
import { cn } from "@/lib/utils";

const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

type UsageExampleCopy = {
	label: string;
	user: string;
	agent: string;
};

function useMcpUsageExampleCopy(id: McpUsageExampleId): UsageExampleCopy {
	const t = useTranslations("agentSetup");

	switch (id) {
		case "ghAssign":
			return {
				label: t("usageExample.ghAssign.label"),
				user: t("usageExample.ghAssign.user"),
				agent: t("usageExample.ghAssign.agent"),
			};
		case "ghUrgent":
			return {
				label: t("usageExample.ghUrgent.label"),
				user: t("usageExample.ghUrgent.user"),
				agent: t("usageExample.ghUrgent.agent"),
			};
		case "nextUp":
			return {
				label: t("usageExample.nextUp.label"),
				user: t("usageExample.nextUp.user"),
				agent: t("usageExample.nextUp.agent"),
			};
		case "backendTag":
			return {
				label: t("usageExample.backendTag.label"),
				user: t("usageExample.backendTag.user"),
				agent: t("usageExample.backendTag.agent"),
			};
		default: {
			const _exhaustive: never = id;
			return _exhaustive;
		}
	}
}

function ExampleChat({
	exampleId,
	compact = false,
}: {
	exampleId: McpUsageExampleId;
	compact?: boolean;
}) {
	const copy = useMcpUsageExampleCopy(exampleId);

	return (
		<div className="flex min-w-0 flex-col justify-center gap-2">
			<p className="calm-kicker">{copy.label}</p>
			<div
				className={cn(
					"ml-auto max-w-[min(92%,100%)] break-words rounded-2xl bg-primary px-3 py-2 text-primary-foreground",
					compact ? "text-xs" : "text-sm",
				)}
			>
				{copy.user}
			</div>
			<div
				className={cn(
					"max-w-[min(94%,100%)] break-words rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-foreground",
					compact ? "text-xs" : "text-sm",
				)}
			>
				{copy.agent}
			</div>
		</div>
	);
}

function ExampleDot({
	id,
	index,
	selected,
	onSelect,
}: {
	id: McpUsageExampleId;
	index: number;
	selected: boolean;
	onSelect: (index: number) => void;
}) {
	const copy = useMcpUsageExampleCopy(id);

	return (
		<button
			type="button"
			className={cn(
				"h-1.5 rounded-full transition-colors",
				selected
					? "w-4 bg-primary"
					: "w-1.5 bg-border/90 hover:bg-foreground/30",
			)}
			aria-label={copy.label}
			aria-current={selected ? "true" : undefined}
			onClick={() => onSelect(index)}
		/>
	);
}

function ExampleDots({
	activeId,
	onSelect,
}: {
	activeId: McpUsageExampleId;
	onSelect: (index: number) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{MCP_USAGE_EXAMPLE_IDS.map((id, index) => (
				<ExampleDot
					key={id}
					id={id}
					index={index}
					selected={id === activeId}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}

export function McpUsageExampleScene({
	playing,
	compact = false,
}: {
	playing: boolean;
	compact?: boolean;
}) {
	const prefersReducedMotion = usePrefersReducedMotion();
	const [index] = useRotatingIndex(
		MCP_USAGE_EXAMPLE_IDS.length,
		MCP_USAGE_TUTORIAL_ROTATE_MS,
		playing && !prefersReducedMotion,
	);
	const exampleId = MCP_USAGE_EXAMPLE_IDS[index] ?? "ghAssign";

	return (
		<div className="flex h-full min-w-0 flex-col justify-center gap-2">
			<AnimatePresence mode="wait">
				<motion.div
					key={exampleId}
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.2, ease: MOTION_EASE }}
				>
					<ExampleChat exampleId={exampleId} compact={compact} />
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

export function McpUsageExamples() {
	const t = useTranslations("agentSetup");
	const prefersReducedMotion = usePrefersReducedMotion();
	const [paused, setPaused] = useState(false);
	const [index, setIndex] = useRotatingIndex(
		MCP_USAGE_EXAMPLE_IDS.length,
		MCP_USAGE_ROTATE_MS,
		!prefersReducedMotion && !paused,
	);
	const exampleId = MCP_USAGE_EXAMPLE_IDS[index] ?? "ghAssign";

	return (
		<section className="min-w-0 space-y-3">
			<h3 className="text-sm font-semibold">{t("usageTitle")}</h3>
			<p className="text-sm leading-relaxed text-muted-foreground">
				{t("usageBestWay")}
			</p>

			{prefersReducedMotion ? (
				<ul className="space-y-3">
					{MCP_USAGE_EXAMPLE_IDS.map((id) => (
						<ReducedExample key={id} id={id} />
					))}
				</ul>
			) : (
				<div
					className="calm-subtle-panel min-w-0 space-y-3 p-3 sm:p-4"
					onMouseEnter={() => setPaused(true)}
					onMouseLeave={() => setPaused(false)}
					onFocus={() => setPaused(true)}
					onBlur={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget as Node)) {
							setPaused(false);
						}
					}}
				>
					<div aria-live="polite" aria-atomic="true">
						<AnimatePresence mode="wait">
							<motion.div
								key={exampleId}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.2, ease: MOTION_EASE }}
							>
								<ExampleChat exampleId={exampleId} />
							</motion.div>
						</AnimatePresence>
					</div>
					<ExampleDots activeId={exampleId} onSelect={setIndex} />
				</div>
			)}
		</section>
	);
}

function ReducedExample({ id }: { id: McpUsageExampleId }) {
	const copy = useMcpUsageExampleCopy(id);

	return (
		<li className="min-w-0 space-y-1">
			<p className="calm-kicker">{copy.label}</p>
			<p className="text-sm text-foreground">{copy.user}</p>
			<p className="text-sm text-muted-foreground">{copy.agent}</p>
		</li>
	);
}
