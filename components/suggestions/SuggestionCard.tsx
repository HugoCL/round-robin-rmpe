"use client";

import { ArrowUp, MessageSquare, Share2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

type SuggestionCardItem = {
	_id: Id<"suggestions">;
	title: string;
	description: string;
	status: string;
	authorName: string;
	upvoteCount: number;
	commentCount: number;
	createdAt: number;
	viewerHasUpvoted: boolean;
};

type SuggestionCardProps = {
	suggestion: SuggestionCardItem;
	locale: string;
	voting: boolean;
	onToggleVote: (suggestionId: Id<"suggestions">) => Promise<void>;
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
	if (status === "planned") return "secondary";
	if (status === "completed") return "outline";
	return "default";
}

export function SuggestionCard({
	suggestion,
	locale,
	voting,
	onToggleVote,
}: SuggestionCardProps) {
	const t = useTranslations();
	const suggestionPath = `/${locale}/suggestions/${suggestion._id}`;

	const formattedDate = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(suggestion.createdAt);

	const handleShare = async () => {
		const shareUrl = `${window.location.origin}${suggestionPath}`;
		try {
			if (navigator.share) {
				await navigator.share({
					title: suggestion.title,
					url: shareUrl,
				});
				return;
			}
			await navigator.clipboard.writeText(shareUrl);
			toast({
				title: t("suggestions.messages.linkCopiedTitle"),
				description: t("suggestions.messages.linkCopiedDescription"),
			});
		} catch {
			toast({
				title: t("suggestions.messages.shareFailedTitle"),
				description: t("suggestions.messages.shareFailedDescription"),
				variant: "destructive",
			});
		}
	};

	return (
		<article className="group px-4 py-4 transition-colors hover:bg-muted/30 md:px-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-base font-semibold leading-tight text-foreground">
							{suggestion.title}
						</h3>
						<Badge variant={statusVariant(suggestion.status)}>
							{t(`suggestions.status.${suggestion.status}`)}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground">
						{t("suggestions.createdBy", {
							name: suggestion.authorName,
							date: formattedDate,
						})}
					</p>
					<p className="max-w-xl text-sm leading-6 text-muted-foreground line-clamp-3">
						{suggestion.description}
					</p>
				</div>
				<Button
					asChild
					variant="ghost"
					size="sm"
					className="shrink-0 rounded-full"
				>
					<Link href={suggestionPath}>{t("suggestions.openDetail")}</Link>
				</Button>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Button
						variant={suggestion.viewerHasUpvoted ? "default" : "outline"}
						size="sm"
						onClick={() => void onToggleVote(suggestion._id)}
						disabled={voting}
						className="rounded-full"
					>
						<ArrowUp className="h-4 w-4" />
						{suggestion.upvoteCount}
					</Button>
					<div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-xs text-muted-foreground">
						<MessageSquare className="h-4 w-4" />
						{suggestion.commentCount}
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void handleShare()}
					className="rounded-full text-muted-foreground"
				>
					<Share2 className="h-4 w-4" />
					{t("suggestions.share")}
				</Button>
			</div>
		</article>
	);
}
