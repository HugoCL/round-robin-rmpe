"use client";

import { useMutation, useQuery } from "convex/react";
import {
	ArrowLeft,
	ArrowUp,
	MessageSquare,
	Share2,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CommentComposer } from "@/components/suggestions/CommentComposer";
import { CommentList } from "@/components/suggestions/CommentList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

type SuggestionStatus = "open" | "planned" | "completed";

function statusVariant(status: string): "default" | "secondary" | "outline" {
	if (status === "planned") return "secondary";
	if (status === "completed") return "outline";
	return "default";
}

export function SuggestionDetail({ suggestionId }: { suggestionId: string }) {
	const t = useTranslations();
	const locale = useLocale();
	const router = useRouter();
	const [voting, setVoting] = useState(false);
	const [commenting, setCommenting] = useState(false);
	const [statusUpdating, setStatusUpdating] = useState(false);
	const [deletingSuggestion, setDeletingSuggestion] = useState(false);
	const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
		null,
	);

	const detail = useQuery(api.suggestions.getSuggestionDetail, {
		suggestionId: suggestionId as Id<"suggestions">,
	});

	const toggleVote = useMutation(api.suggestions.toggleSuggestionVote);
	const addComment = useMutation(api.suggestions.addSuggestionComment);
	const updateStatus = useMutation(api.suggestions.updateSuggestionStatus);
	const deleteSuggestion = useMutation(api.suggestions.deleteSuggestion);
	const deleteSuggestionComment = useMutation(
		api.suggestions.deleteSuggestionComment,
	);

	const handleShare = async () => {
		const shareUrl = window.location.href;
		if (!detail) return;

		try {
			if (navigator.share) {
				await navigator.share({
					title: detail.suggestion.title,
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

	const handleToggleVote = async () => {
		setVoting(true);
		try {
			await toggleVote({
				suggestionId: suggestionId as Id<"suggestions">,
			});
		} catch {
			toast({
				title: t("suggestions.messages.voteFailedTitle"),
				description: t("suggestions.messages.voteFailedDescription"),
				variant: "destructive",
			});
		}
		setVoting(false);
	};

	const handleCommentSubmit = async (body: string) => {
		setCommenting(true);
		try {
			await addComment({
				suggestionId: suggestionId as Id<"suggestions">,
				body,
			});
			toast({
				title: t("suggestions.messages.commentCreatedTitle"),
				description: t("suggestions.messages.commentCreatedDescription"),
			});
		} catch {
			toast({
				title: t("suggestions.messages.commentFailedTitle"),
				description: t("suggestions.messages.commentFailedDescription"),
				variant: "destructive",
			});
		}
		setCommenting(false);
	};

	const handleStatusChange = async (status: SuggestionStatus) => {
		setStatusUpdating(true);
		try {
			await updateStatus({
				suggestionId: suggestionId as Id<"suggestions">,
				status,
			});
			toast({
				title: t("suggestions.messages.statusUpdatedTitle"),
				description: t("suggestions.messages.statusUpdatedDescription"),
			});
		} catch {
			toast({
				title: t("suggestions.messages.statusFailedTitle"),
				description: t("suggestions.messages.statusFailedDescription"),
				variant: "destructive",
			});
		}
		setStatusUpdating(false);
	};

	const handleDeleteSuggestion = async () => {
		if (!window.confirm(t("suggestions.confirmDeleteSuggestion"))) {
			return;
		}
		setDeletingSuggestion(true);
		try {
			await deleteSuggestion({
				suggestionId: suggestionId as Id<"suggestions">,
			});
			toast({
				title: t("suggestions.messages.suggestionDeletedTitle"),
				description: t("suggestions.messages.suggestionDeletedDescription"),
			});
			router.replace(`/${locale}/suggestions`);
		} catch {
			toast({
				title: t("suggestions.messages.deleteFailedTitle"),
				description: t("suggestions.messages.deleteFailedDescription"),
				variant: "destructive",
			});
			setDeletingSuggestion(false);
		}
	};

	const handleDeleteComment = async (commentId: Id<"suggestionComments">) => {
		if (!window.confirm(t("suggestions.confirmDeleteComment"))) {
			return;
		}
		setDeletingCommentId(commentId);
		try {
			await deleteSuggestionComment({ commentId });
			toast({
				title: t("suggestions.messages.commentDeletedTitle"),
				description: t("suggestions.messages.commentDeletedDescription"),
			});
		} catch {
			toast({
				title: t("suggestions.messages.commentDeleteFailedTitle"),
				description: t("suggestions.messages.commentDeleteFailedDescription"),
				variant: "destructive",
			});
		}
		setDeletingCommentId(null);
	};

	if (detail === undefined) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="rounded-lg border p-6 text-sm text-muted-foreground">
					{t("common.loading")}
				</div>
			</div>
		);
	}

	if (!detail) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<Card>
					<CardHeader>
						<CardTitle>{t("suggestions.notFoundTitle")}</CardTitle>
						<CardDescription>
							{t("suggestions.notFoundDescription")}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link href={`/${locale}/suggestions`}>
								{t("suggestions.backToBoard")}
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { suggestion, comments, canModerate } = detail;
	const formattedDate = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(suggestion.createdAt);

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
			<div>
				<Button variant="ghost" asChild>
					<Link href={`/${locale}/suggestions`}>
						<ArrowLeft className="h-4 w-4" />
						{t("suggestions.backToBoard")}
					</Link>
				</Button>
			</div>

			<Card>
				<CardHeader className="space-y-3">
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-2">
							<CardTitle className="text-2xl leading-tight">
								{suggestion.title}
							</CardTitle>
							<CardDescription>
								{t("suggestions.createdBy", {
									name: suggestion.authorName,
									date: formattedDate,
								})}
							</CardDescription>
						</div>
						<Badge variant={statusVariant(suggestion.status)}>
							{t(`suggestions.status.${suggestion.status}`)}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm leading-relaxed whitespace-pre-wrap">
						{suggestion.description}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant={suggestion.viewerHasUpvoted ? "default" : "outline"}
							size="sm"
							onClick={() => void handleToggleVote()}
							disabled={voting}
						>
							<ArrowUp className="h-4 w-4" />
							{suggestion.upvoteCount}
						</Button>
						<div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
							<MessageSquare className="h-4 w-4" />
							{suggestion.commentCount}
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void handleShare()}
						>
							<Share2 className="h-4 w-4" />
							{t("suggestions.share")}
						</Button>
					</div>
					{canModerate ? (
						<div className="flex flex-wrap items-center gap-2 pt-2">
							<Select
								value={suggestion.status}
								onValueChange={(value) =>
									void handleStatusChange(value as SuggestionStatus)
								}
								disabled={statusUpdating}
							>
								<SelectTrigger className="w-52">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="open">
										{t("suggestions.status.open")}
									</SelectItem>
									<SelectItem value="planned">
										{t("suggestions.status.planned")}
									</SelectItem>
									<SelectItem value="completed">
										{t("suggestions.status.completed")}
									</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => void handleDeleteSuggestion()}
								disabled={deletingSuggestion}
							>
								<Trash2 className="h-4 w-4" />
								{t("suggestions.deleteSuggestion")}
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t("suggestions.addCommentTitle")}</CardTitle>
				</CardHeader>
				<CardContent>
					<CommentComposer
						submitting={commenting}
						onSubmit={handleCommentSubmit}
					/>
				</CardContent>
			</Card>

			<CommentList
				locale={locale}
				comments={comments}
				canModerate={canModerate}
				deletingCommentId={deletingCommentId}
				onDeleteComment={handleDeleteComment}
			/>
		</div>
	);
}
