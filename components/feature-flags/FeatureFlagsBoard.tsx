"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Flag } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FeatureFlagCard } from "@/components/feature-flags/FeatureFlagCard";
import { FeatureFlagComposer } from "@/components/feature-flags/FeatureFlagComposer";
import {
	getAgeDays,
	isStale,
	STALE_DAYS_THRESHOLD,
} from "@/components/feature-flags/featureFlagAge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

type FeatureFlagStatusFilter = "active" | "removed" | "all";
type FeatureFlagSort = "oldest" | "newest" | "key";

const statusFilters: FeatureFlagStatusFilter[] = ["active", "removed", "all"];

type FeatureFlagsBoardProps = {
	teamSlug: string;
	canManage: boolean;
};

export function FeatureFlagsBoard({
	teamSlug,
	canManage,
}: FeatureFlagsBoardProps) {
	const t = useTranslations();
	const locale = useLocale();
	const removeFeatureFlag = useMutation(api.featureFlags.removeFeatureFlag);
	const [statusFilter, setStatusFilter] =
		useState<FeatureFlagStatusFilter>("active");
	const [sort, setSort] = useState<FeatureFlagSort>("oldest");
	const [removingFlagId, setRemovingFlagId] = useState<string | null>(null);

	const board = useQuery(api.featureFlags.listFeatureFlagsForTeam, {
		teamSlug,
		status: statusFilter,
		sort,
	});

	const activeBoard = useQuery(api.featureFlags.listFeatureFlagsForTeam, {
		teamSlug,
		status: "active",
		sort: "oldest",
	});

	const staleActiveCount = useMemo(() => {
		if (!activeBoard?.flags) return 0;
		return activeBoard.flags.filter((flag) =>
			isStale(getAgeDays(flag.createdAt)),
		).length;
	}, [activeBoard?.flags]);

	const handleRemove = async (featureFlagId: Id<"featureFlags">) => {
		setRemovingFlagId(featureFlagId);
		try {
			await removeFeatureFlag({ featureFlagId });
			toast({
				title: t("featureFlags.messages.removedTitle"),
				description: t("featureFlags.messages.removedDescription"),
			});
		} catch {
			toast({
				title: t("featureFlags.messages.removeFailedTitle"),
				description: t("featureFlags.messages.removeFailedDescription"),
				variant: "destructive",
			});
		}
		setRemovingFlagId(null);
	};

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<div className="space-y-6">
				<section className="page-enter-soft calm-shell px-5 py-7 md:px-7 md:py-8">
					<div className="space-y-4">
						<Button
							asChild
							variant="ghost"
							size="sm"
							className="-ml-2 rounded-full"
						>
							<Link href={`/${locale}/${teamSlug}`}>
								<ArrowLeft className="mr-2 h-4 w-4" />
								{t("featureFlags.backToTeam")}
							</Link>
						</Button>
						<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] lg:items-end">
							<div className="space-y-3">
								<div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
									<Flag className="h-4 w-4" />
									{t("featureFlags.title")}
								</div>
								<h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
									{t("featureFlags.heading")}
								</h1>
								<p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
									{t("featureFlags.description")}
								</p>
							</div>
							{board ? (
								<div className="flex flex-wrap gap-2 lg:justify-end">
									<div className="rounded-full border border-border/70 bg-background/75 px-4 py-2 text-sm">
										{t("featureFlags.summary.active", {
											count: board.summary.activeCount,
										})}
									</div>
									{board.summary.activeCount > 0 ? (
										<div className="rounded-full border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
											{t("featureFlags.summary.stale", {
												count: staleActiveCount,
												days: STALE_DAYS_THRESHOLD,
											})}
										</div>
									) : null}
								</div>
							) : null}
						</div>
					</div>
				</section>

				{canManage ? <FeatureFlagComposer teamSlug={teamSlug} /> : null}

				<section className="calm-shell overflow-hidden">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 md:px-5">
						<div className="flex flex-wrap gap-2">
							{statusFilters.map((filter) => (
								<Button
									key={filter}
									type="button"
									variant={statusFilter === filter ? "default" : "outline"}
									onClick={() => setStatusFilter(filter)}
									className="rounded-full px-4"
								>
									{t(`featureFlags.filters.${filter}`)}
								</Button>
							))}
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant={sort === "oldest" ? "default" : "outline"}
								onClick={() => setSort("oldest")}
								className="rounded-full px-4"
							>
								{t("featureFlags.sort.oldest")}
							</Button>
							<Button
								type="button"
								variant={sort === "newest" ? "default" : "outline"}
								onClick={() => setSort("newest")}
								className="rounded-full px-4"
							>
								{t("featureFlags.sort.newest")}
							</Button>
							<Button
								type="button"
								variant={sort === "key" ? "default" : "outline"}
								onClick={() => setSort("key")}
								className="rounded-full px-4"
							>
								{t("featureFlags.sort.key")}
							</Button>
						</div>
					</div>

					{board === undefined ? (
						<div className="space-y-3 px-4 py-6 md:px-5">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : board.flags.length === 0 ? (
						<div className="px-4 py-12 text-center md:px-5">
							<p className="text-lg font-semibold">
								{t(`featureFlags.empty.${statusFilter}.title`)}
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t(`featureFlags.empty.${statusFilter}.description`)}
							</p>
						</div>
					) : (
						<div className="divide-y divide-border/70">
							{board.flags.map((flag) => (
								<FeatureFlagCard
									key={flag._id}
									flag={flag}
									locale={locale}
									canManage={canManage}
									removing={removingFlagId === flag._id}
									onRemove={handleRemove}
								/>
							))}
						</div>
					)}
				</section>

				{!canManage ? (
					<p className="text-center text-sm text-muted-foreground">
						{t("featureFlags.readOnlyHint")}
					</p>
				) : null}
			</div>
		</div>
	);
}
