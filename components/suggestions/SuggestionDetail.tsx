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
			<div className="container mx-auto max-w-5xl px-4 py-8">
				<div className="calm-section text-sm text-muted-foreground">
					{t("common.loading")}
				</div>
			</div>
		);
	}

	if (!detail) {
		return (
			<div className="container mx-auto max-w-5xl px-4 py-8">
				<section className="calm-section max-w-2xl">
					<h2 className="text-2xl font-semibold">
						{t("suggestions.notFoundTitle")}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t("suggestions.notFoundDescription")}
					</p>
					<Button asChild className="w-fit rounded-full px-5">
						<Link href={`/${locale}/suggestions`}>
							{t("suggestions.backToBoard")}
						</Link>
					</Button>
				</section>
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
		<div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
			<div>
				<Button variant="ghost" asChild className="rounded-full">
					<Link href={`/${locale}/suggestions`}>
						<ArrowLeft className="h-4 w-4" />
						{t("suggestions.backToBoard")}
					</Link>
				</Button>
			</div>

			<section className="page-enter-soft calm-shell px-5 py-6 md:px-7 md:py-7">
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
					<div className="space-y-5">
						<div className="flex items-start justify-between gap-3">
							<div className="space-y-2">
								<p className="calm-kicker">{t("suggestions.title")}</p>
								<h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
									{suggestion.title}
								</h1>
								<p className="text-sm text-muted-foreground">
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
						<p className="max-w-3xl text-sm leading-7 whitespace-pre-wrap text-foreground/90">
							{suggestion.description}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant={suggestion.viewerHasUpvoted ? "default" : "outline"}
								size="sm"
								onClick={() => void handleToggleVote()}
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
							<Button
								variant="outline"
								size="sm"
								onClick={() => void handleShare()}
								className="rounded-full"
							>
								<Share2 className="h-4 w-4" />
								{t("suggestions.share")}
							</Button>
						</div>
					</div>

					{canModerate ? (
						<div className="calm-subtle-panel space-y-3 px-4 py-4">
							<p className="calm-kicker">{t("common.manage")}</p>
							<Select
								value={suggestion.status}
								onValueChange={(value) =>
									void handleStatusChange(value as SuggestionStatus)
								}
								disabled={statusUpdating}
							>
								<SelectTrigger className="w-full rounded-2xl border-border/70 bg-background/70">
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
								className="rounded-full"
							>
								<Trash2 className="h-4 w-4" />
								{t("suggestions.deleteSuggestion")}
							</Button>
						</div>
					) : null}
				</div>
			</section>

			<section className="calm-section">
				<div className="space-y-1">
					<p className="calm-kicker">{t("suggestions.addCommentTitle")}</p>
					<h2 className="text-xl font-semibold">
						{t("suggestions.addCommentTitle")}
					</h2>
				</div>
				<div className="rounded-2xl border border-border/60 bg-background/70 p-4">
					<CommentComposer
						submitting={commenting}
						onSubmit={handleCommentSubmit}
					/>
				</div>
			</section>

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
