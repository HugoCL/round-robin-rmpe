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
		<div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
			<div className="space-y-2">
				<div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
					<Lightbulb className="h-4 w-4" />
					{t("suggestions.title")}
				</div>
				<h1 className="text-3xl font-bold">{t("suggestions.heading")}</h1>
				<p className="text-muted-foreground">{t("suggestions.description")}</p>
				<Button asChild variant="outline" size="sm">
					<Link href={`/${locale}`}>{t("suggestions.backHome")}</Link>
				</Button>
			</div>

			<SuggestionComposer />

			<div className="flex justify-end">
				<div className="flex gap-2">
					<Button
						type="button"
						variant={sort === "top" ? "default" : "outline"}
						onClick={() => setSort("top")}
					>
						{t("suggestions.sort.top")}
					</Button>
					<Button
						type="button"
						variant={sort === "new" ? "default" : "outline"}
						onClick={() => setSort("new")}
					>
						{t("suggestions.sort.new")}
					</Button>
				</div>
			</div>

			{suggestionsBoard === undefined ? (
				<SuggestionsBoardSkeleton />
			) : (
				<div className="grid gap-4 lg:grid-cols-3 lg:items-start">
					{statuses.map((status) => (
						<section
							key={status}
							className="rounded-lg border bg-muted/20 p-4 space-y-4"
						>
							<div className="flex items-center justify-between gap-3 border-b pb-3">
								<h2 className="font-semibold">
									{t(`suggestions.status.${status}`)}
								</h2>
								<div className="rounded-full border bg-background px-2.5 py-1 text-sm font-medium">
									{suggestionsBoard[status].length}
								</div>
							</div>

							{suggestionsBoard[status].length === 0 ? (
								<div className="rounded-lg border border-dashed bg-background p-4 space-y-1">
									<p className="font-medium">{t("suggestions.emptyTitle")}</p>
									<p className="text-sm text-muted-foreground">
										{t("suggestions.emptyDescription")}
									</p>
								</div>
							) : (
								<div className="grid gap-4">
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
		</div>
	);
}

function SuggestionsBoardSkeleton() {
	return (
		<div className="grid gap-4 lg:grid-cols-3 lg:items-start">
			{statuses.map((status) => (
				<div
					key={status}
					className="rounded-lg border bg-muted/20 p-4 space-y-4"
				>
					<div className="flex items-center justify-between gap-3 border-b pb-3">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-8 w-10 rounded-full" />
					</div>
					<div className="grid gap-4">
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
		<div className="rounded-lg border bg-background p-6 space-y-4">
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
