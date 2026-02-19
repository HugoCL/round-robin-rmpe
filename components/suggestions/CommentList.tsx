"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Id } from "@/convex/_generated/dataModel";

type CommentItem = {
	_id: Id<"suggestionComments">;
	authorName: string;
	body: string;
	createdAt: number;
};

type CommentListProps = {
	locale: string;
	comments: CommentItem[];
	canModerate: boolean;
	deletingCommentId: string | null;
	onDeleteComment: (commentId: Id<"suggestionComments">) => Promise<void>;
};

export function CommentList({
	locale,
	comments,
	canModerate,
	deletingCommentId,
	onDeleteComment,
}: CommentListProps) {
	const t = useTranslations();

	if (comments.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("suggestions.commentsTitle")}</CardTitle>
					<CardDescription>{t("suggestions.commentsEmpty")}</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("suggestions.commentsTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{comments.map((comment) => {
					const formattedDate = new Intl.DateTimeFormat(locale, {
						year: "numeric",
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					}).format(comment.createdAt);

					return (
						<div key={comment._id} className="rounded-lg border p-3 space-y-2">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-medium">
									{t("suggestions.commentBy", {
										name: comment.authorName,
										date: formattedDate,
									})}
								</p>
								{canModerate ? (
									<Button
										variant="ghost"
										size="sm"
										disabled={deletingCommentId === comment._id}
										onClick={() => void onDeleteComment(comment._id)}
									>
										<Trash2 className="h-4 w-4" />
										{t("suggestions.deleteComment")}
									</Button>
								) : null}
							</div>
							<p className="text-sm text-muted-foreground whitespace-pre-wrap">
								{comment.body}
							</p>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
