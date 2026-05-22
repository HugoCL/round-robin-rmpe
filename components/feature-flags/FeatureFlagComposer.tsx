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

type FeatureFlagComposerProps = {
	teamSlug: string;
	onCreated?: () => void;
};

export function FeatureFlagComposer({
	teamSlug,
	onCreated,
}: FeatureFlagComposerProps) {
	const t = useTranslations();
	const createFeatureFlag = useMutation(api.featureFlags.createFeatureFlag);
	const [key, setKey] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const normalizedKey = key.trim();
		if (normalizedKey.length < 2) {
			setError(t("featureFlags.validation.key"));
			return;
		}

		const normalizedDescription = description.trim();
		if (
			normalizedDescription.length > 0 &&
			(normalizedDescription.length < 1 || normalizedDescription.length > 500)
		) {
			setError(t("featureFlags.validation.description"));
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			await createFeatureFlag({
				teamSlug,
				key: normalizedKey,
				description:
					normalizedDescription.length > 0 ? normalizedDescription : undefined,
			});
			setKey("");
			setDescription("");
			toast({
				title: t("featureFlags.messages.createdTitle"),
				description: t("featureFlags.messages.createdDescription"),
			});
			onCreated?.();
		} catch (createError) {
			const message =
				createError instanceof Error
					? createError.message
					: t("featureFlags.messages.createFailed");
			setError(message);
		}
		setSubmitting(false);
	};

	return (
		<section className="calm-shell px-5 py-6 md:px-7">
			<div className="grid gap-6 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
				<div className="space-y-2">
					<p className="calm-kicker">{t("featureFlags.composeTitle")}</p>
					<h2 className="text-2xl font-semibold tracking-tight">
						{t("featureFlags.composeHeading")}
					</h2>
					<p className="text-sm leading-7 text-muted-foreground">
						{t("featureFlags.composeDescription")}
					</p>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="feature-flag-key">
							{t("featureFlags.keyLabel")}
						</Label>
						<Input
							id="feature-flag-key"
							value={key}
							onChange={(event) => setKey(event.target.value)}
							placeholder={t("featureFlags.keyPlaceholder")}
							maxLength={80}
							disabled={submitting}
							className="calm-input-surface h-12 font-mono"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="feature-flag-description">
							{t("featureFlags.descriptionLabel")}
						</Label>
						<Textarea
							id="feature-flag-description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder={t("featureFlags.descriptionPlaceholder")}
							maxLength={500}
							rows={4}
							disabled={submitting}
							className="calm-input-surface min-h-28"
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
						{submitting
							? t("featureFlags.submitting")
							: t("featureFlags.submit")}
					</Button>
				</form>
			</div>
		</section>
	);
}
