"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PageIntro } from "@/components/PageIntro";
import { SecondaryPageNav } from "@/components/SecondaryPageNav";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { SuggestionComposer } from "@/components/suggestions/SuggestionComposer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SuggestionStatus = "open" | "planned" | "completed";
type SuggestionSort = "top" | "new";

const statuses: SuggestionStatus[] = ["open", "planned", "completed"];

/** Selected sort is marked with a tint, not a solid primary fill. */
const sortActive =
	"border-primary/40 bg-primary/12 text-primary hover:bg-primary/16 hover:text-primary";

export function SuggestionsBoard() {
	const t = useTranslations();
	const locale = useLocale();
	const toggleVote = useMutation(api.suggestions.toggleSuggestionVote);
	const [sort, setSort] = useState<SuggestionSort>("top");
	const [votingSuggestionId, setVotingSuggestionId] = useState<string | null>(
		null,
	);

	// The board requires an identity, so it waits for Clerk's token rather than
	// firing unauthenticated on a cold page load.
	const { isAuthenticated } = useConvexAuth();
	const suggestionsBoard = useQuery(
		api.suggestions.listSuggestionsBoard,
		isAuthenticated ? { sort, limitPerStatus: 50 } : "skip",
	);

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
		<>
			<SecondaryPageNav />
			<div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
				<div className="space-y-6">
					<PageIntro
						icon={<Lightbulb aria-hidden="true" />}
						kicker={t("suggestions.title")}
						title={t("suggestions.heading")}
						description={t("suggestions.description")}
					/>

					<section className="page-enter">
						<SuggestionComposer />
					</section>

					<section className="page-enter space-y-4">
						<div
							className="flex flex-wrap items-center justify-end gap-2"
							role="group"
							aria-label={t("suggestions.sort.label")}
						>
							<Button
								type="button"
								variant="outline"
								aria-pressed={sort === "top"}
								onClick={() => setSort("top")}
								className={cn(
									"rounded-full px-5",
									sort === "top" && sortActive,
								)}
							>
								{t("suggestions.sort.top")}
							</Button>
							<Button
								type="button"
								variant="outline"
								aria-pressed={sort === "new"}
								onClick={() => setSort("new")}
								className={cn(
									"rounded-full px-5",
									sort === "new" && sortActive,
								)}
							>
								{t("suggestions.sort.new")}
							</Button>
						</div>
						{suggestionsBoard === undefined ? (
							<SuggestionsBoardSkeleton />
						) : (
							<div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
								{statuses.map((status) => (
									<section key={status} className="calm-section flex flex-col">
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
		</>
	);
}

function SuggestionsBoardSkeleton() {
	return (
		<div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
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
