"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CommentComposerProps = {
	submitting: boolean;
	onSubmit: (body: string) => Promise<void>;
};

export function CommentComposer({
	submitting,
	onSubmit,
}: CommentComposerProps) {
	const t = useTranslations();
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalized = body.trim();
		if (normalized.length < 1 || normalized.length > 1000) {
			setError(t("suggestions.validation.comment"));
			return;
		}
		setError(null);
		await onSubmit(normalized);
		setBody("");
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<Textarea
				value={body}
				onChange={(event) => setBody(event.target.value)}
				placeholder={t("suggestions.commentPlaceholder")}
				maxLength={1000}
				rows={4}
				disabled={submitting}
			/>
			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
			<Button type="submit" disabled={submitting}>
				{submitting
					? t("suggestions.commentSubmitting")
					: t("suggestions.commentSubmit")}
			</Button>
		</form>
	);
}
