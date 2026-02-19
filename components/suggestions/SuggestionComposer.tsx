"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
		<Card>
			<CardHeader>
				<CardTitle>{t("suggestions.composeTitle")}</CardTitle>
				<CardDescription>{t("suggestions.composeDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
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
							rows={4}
							disabled={submitting}
						/>
					</div>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
					<Button type="submit" disabled={submitting}>
						{submitting ? t("suggestions.submitting") : t("suggestions.submit")}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
