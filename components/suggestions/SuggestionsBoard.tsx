"use client";

import { useMutation, useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { SuggestionComposer } from "@/components/suggestions/SuggestionComposer";
import { Button } from "@/components/ui/button";
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
	const [status, setStatus] = useState<SuggestionStatus>("open");
	const [sort, setSort] = useState<SuggestionSort>("top");
	const [votingSuggestionId, setVotingSuggestionId] = useState<string | null>(
		null,
	);

	const suggestions = useQuery(api.suggestions.listSuggestions, {
		status,
		sort,
		limit: 50,
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

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap gap-2">
					{statuses.map((statusOption) => (
						<Button
							key={statusOption}
							type="button"
							variant={status === statusOption ? "default" : "outline"}
							onClick={() => setStatus(statusOption)}
						>
							{t(`suggestions.status.${statusOption}`)}
						</Button>
					))}
				</div>
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

			{suggestions === undefined ? (
				<div className="rounded-lg border p-6 text-sm text-muted-foreground">
					{t("common.loading")}
				</div>
			) : suggestions.length === 0 ? (
				<div className="rounded-lg border p-6 space-y-1">
					<p className="font-medium">{t("suggestions.emptyTitle")}</p>
					<p className="text-sm text-muted-foreground">
						{t("suggestions.emptyDescription")}
					</p>
				</div>
			) : (
				<div className="grid gap-4">
					{suggestions.map((suggestion) => (
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
		</div>
	);
}
