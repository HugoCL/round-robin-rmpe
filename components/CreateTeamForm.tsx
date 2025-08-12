"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumerics
		.replace(/\s+/g, "-") // spaces to hyphens
		.replace(/-+/g, "-"); // collapse multiple hyphens
}

export default function CreateTeamForm() {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations();
	const createTeam = useMutation(api.mutations.createTeam);

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const derivedSlug = useMemo(
		() => (slug ? slugify(slug) : slugify(name)),
		[name, slug],
	);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			const finalSlug = derivedSlug;
			if (!name.trim() || !finalSlug) {
				setError(t("team.errorProvideName"));
				setSubmitting(false);
				return;
			}
			await createTeam({ name: name.trim(), slug: finalSlug });
			router.replace(`/${locale}/${finalSlug}`);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : t("team.createError", { default: "Failed to create team" });
			setError(message);
			setSubmitting(false);
		}
	};

	return (
		<Card className="max-w-xl w-full">
			<CardHeader>
				<CardTitle>{t("team.formTitle")}</CardTitle>
				<CardDescription>{t("team.formDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="team-name">{t("team.nameLabel")}</Label>
						<Input
								id="team-name"
								placeholder={t("team.namePlaceholder")}
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="team-slug">{t("team.slugLabel")}</Label>
						<Input
								id="team-slug"
								placeholder={t("team.slugPlaceholder")}
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
							/>
						<p className="text-xs text-muted-foreground">
							{t("team.slugWillUsePrefix")} <span className="font-mono">{derivedSlug || ""}</span>
						</p>
					</div>
					{error && (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					)}
					<div className="pt-2">
						<Button type="submit" disabled={submitting}>
							{submitting ? t("team.creatingEllipsis") : t("team.createButton")}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
