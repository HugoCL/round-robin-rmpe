"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";

type SuggestionComposerProps = {
	onCreated?: (suggestionId: string) => void;
};

export function SuggestionComposer({ onCreated }: SuggestionComposerProps) {
	const t = useTranslations();
	const createSuggestion = useMutation(api.suggestions.createSuggestion);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const normalizedTitle = title.trim();
		const normalizedDescription = description.trim();

		if (normalizedTitle.length < 3 || normalizedTitle.length > 120) {
			setError(t("suggestions.validation.title"));
			return;
		}

		if (
			normalizedDescription.length < 3 ||
			normalizedDescription.length > 2000
		) {
			setError(t("suggestions.validation.description"));
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			const result = await createSuggestion({
				title: normalizedTitle,
				description: normalizedDescription,
			});
			setTitle("");
			setDescription("");
			toast({
				title: t("suggestions.messages.createdTitle"),
				description: t("suggestions.messages.createdDescription"),
			});
			onCreated?.(result.suggestionId);
		} catch (createError) {
			const message =
				createError instanceof Error
					? createError.message
					: t("suggestions.messages.createFailed");
			setError(message);
		}
		setSubmitting(false);
	};

	return (
		<section className="calm-shell px-5 py-6 md:px-7">
			<div className="grid gap-6 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
				<div className="space-y-2">
					<p className="calm-kicker">{t("suggestions.composeTitle")}</p>
					<h2 className="text-2xl font-semibold tracking-tight">
						{t("suggestions.composeTitle")}
					</h2>
					<p className="text-sm leading-7 text-muted-foreground">
						{t("suggestions.composeDescription")}
					</p>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="suggestion-title">
							{t("suggestions.titleLabel")}
						</Label>
						<Input
							id="suggestion-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder={t("suggestions.titlePlaceholder")}
							maxLength={120}
							disabled={submitting}
							className="calm-input-surface h-12"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="suggestion-description">
							{t("suggestions.descriptionLabel")}
						</Label>
						<Textarea
							id="suggestion-description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder={t("suggestions.descriptionPlaceholder")}
							maxLength={2000}
							rows={5}
							disabled={submitting}
							className="calm-input-surface min-h-32"
						/>
					</div>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					<Button
						type="submit"
						disabled={submitting}
						className="rounded-full px-5"
					>
						{submitting ? t("suggestions.submitting") : t("suggestions.submit")}
					</Button>
				</form>
			</div>
		</section>
	);
}
