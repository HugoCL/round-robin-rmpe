"use client";

import { ArrowUp, MessageSquare, Share2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
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
		<Card>
			<CardHeader className="space-y-3">
				<div className="flex items-start justify-between gap-3">
					<div className="space-y-1">
						<h3 className="text-lg font-semibold leading-tight">
							{suggestion.title}
						</h3>
						<p className="text-xs text-muted-foreground">
							{t("suggestions.createdBy", {
								name: suggestion.authorName,
								date: formattedDate,
							})}
						</p>
					</div>
					<Badge variant={statusVariant(suggestion.status)}>
						{t(`suggestions.status.${suggestion.status}`)}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground line-clamp-3">
					{suggestion.description}
				</p>
			</CardContent>
			<CardFooter className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Button
						variant={suggestion.viewerHasUpvoted ? "default" : "outline"}
						size="sm"
						onClick={() => void onToggleVote(suggestion._id)}
						disabled={voting}
					>
						<ArrowUp className="h-4 w-4" />
						{suggestion.upvoteCount}
					</Button>
					<div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
						<MessageSquare className="h-4 w-4" />
						{suggestion.commentCount}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={() => void handleShare()}>
						<Share2 className="h-4 w-4" />
						{t("suggestions.share")}
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link href={suggestionPath}>{t("suggestions.openDetail")}</Link>
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}
