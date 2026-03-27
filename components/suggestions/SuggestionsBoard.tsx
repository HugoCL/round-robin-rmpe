"use client";

import { useMutation, useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { SuggestionComposer } from "@/components/suggestions/SuggestionComposer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

type SuggestionStatus = "open" | "planned" | "completed";
type SuggestionSort = "top" | "new";

const statuses: SuggestionStatus[] = ["open", "planned", "completed"];

export function SuggestionsBoard() {
	const t = useTranslations();
	const locale = useLocale();
	const toggleVote = useMutation(api.suggestions.toggleSuggestionVote);
	const [sort, setSort] = useState<SuggestionSort>("top");
	const [votingSuggestionId, setVotingSuggestionId] = useState<string | null>(
		null,
	);

	const suggestionsBoard = useQuery(api.suggestions.listSuggestionsBoard, {
		sort,
		limitPerStatus: 50,
	});

	const handleToggleVote = async (suggestionId: Id<"suggestions">) => {
		setVotingSuggestionId(suggestionId);
		try {
			await toggleVote({ suggestionId });
		} catch {
			toast({
				title: t("suggestions.messages.voteFailedTitle"),
				description: t("suggestions.messages.voteFailedDescription"),
				variant: "destructive",
			});
		}
		setVotingSuggestionId(null);
	};

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<div className="space-y-6">
				<section className="page-enter-soft calm-shell px-5 py-7 md:px-7 md:py-8">
					<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-end">
						<div className="space-y-3">
							<div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
								<Lightbulb className="h-4 w-4" />
								{t("suggestions.title")}
							</div>
							<h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
								{t("suggestions.heading")}
							</h1>
							<p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
								{t("suggestions.description")}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2 lg:justify-end">
							<Button
								type="button"
								variant={sort === "top" ? "default" : "outline"}
								onClick={() => setSort("top")}
								className="rounded-full px-5"
							>
								{t("suggestions.sort.top")}
							</Button>
							<Button
								type="button"
								variant={sort === "new" ? "default" : "outline"}
								onClick={() => setSort("new")}
								className="rounded-full px-5"
							>
								{t("suggestions.sort.new")}
							</Button>
							<Button asChild variant="outline" className="rounded-full px-5">
								<Link href={`/${locale}`}>{t("suggestions.backHome")}</Link>
							</Button>
						</div>
					</div>
				</section>

				<section className="page-enter">
					<SuggestionComposer />
				</section>

				<section className="page-enter space-y-4">
					<div className="space-y-1">
						<p className="calm-kicker">{t("suggestions.title")}</p>
						<h2 className="text-2xl font-semibold tracking-tight">
							{t("suggestions.heading")}
						</h2>
					</div>
					{suggestionsBoard === undefined ? (
						<SuggestionsBoardSkeleton />
					) : (
						<div className="grid gap-4 lg:grid-cols-3 lg:items-start">
							{statuses.map((status) => (
								<section key={status} className="calm-section">
									<div className="calm-section-header pb-3">
										<div>
											<h3 className="text-base font-semibold">
												{t(`suggestions.status.${status}`)}
											</h3>
										</div>
										<div className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-sm font-medium">
											{suggestionsBoard[status].length}
										</div>
									</div>

									{suggestionsBoard[status].length === 0 ? (
										<div className="rounded-2xl border border-dashed border-border/70 bg-muted/16 p-4 space-y-1">
											<p className="font-medium">
												{t("suggestions.emptyTitle")}
											</p>
											<p className="text-sm text-muted-foreground">
												{t("suggestions.emptyDescription")}
											</p>
										</div>
									) : (
										<div className="calm-list">
											{suggestionsBoard[status].map((suggestion) => (
												<SuggestionCard
													key={suggestion._id}
													suggestion={suggestion}
													locale={locale}
													voting={votingSuggestionId === suggestion._id}
													onToggleVote={handleToggleVote}
												/>
											))}
										</div>
									)}
								</section>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function SuggestionsBoardSkeleton() {
	return (
		<div className="grid gap-4 lg:grid-cols-3 lg:items-start">
			{statuses.map((status) => (
				<div key={status} className="calm-section">
					<div className="calm-section-header pb-3">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-8 w-10 rounded-full" />
					</div>
					<div className="calm-list">
						<SuggestionCardSkeleton />
						<SuggestionCardSkeleton />
					</div>
				</div>
			))}
		</div>
	);
}

function SuggestionCardSkeleton() {
	return (
		<div className="px-4 py-4 space-y-4 md:px-5">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-2 flex-1">
					<Skeleton className="h-5 w-3/4" />
					<Skeleton className="h-4 w-1/2" />
				</div>
				<Skeleton className="h-6 w-20" />
			</div>
			<div className="space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
			<div className="flex items-center justify-between gap-3">
				<div className="flex gap-2">
					<Skeleton className="h-9 w-14" />
					<Skeleton className="h-9 w-12" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-16" />
					<Skeleton className="h-9 w-16" />
				</div>
			</div>
		</div>
	);
}
