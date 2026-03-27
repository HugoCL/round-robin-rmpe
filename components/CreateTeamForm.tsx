"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";

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

	// unique ids for inputs
	const nameId = useId();
	const slugId = useId();

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
				err instanceof Error
					? err.message
					: t("team.createError", { default: "Failed to create team" });
			setError(message);
			setSubmitting(false);
		}
	};

	return (
		<section className="calm-shell w-full max-w-3xl overflow-hidden">
			<div className="grid gap-0 lg:grid-cols-[0.82fr_minmax(0,1.18fr)]">
				<div className="bg-muted/25 px-6 py-8 md:px-8 md:py-10">
					<p className="calm-kicker">La Lista</p>
					<h1 className="mt-3 text-3xl font-semibold tracking-tight">
						{t("team.formTitle")}
					</h1>
					<p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
						{t("team.formDescription")}
					</p>
					<div className="mt-8 rounded-2xl border border-border/60 bg-background/72 px-4 py-4">
						<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
							{t("team.slugLabel")}
						</p>
						<p className="mt-2 font-mono text-sm text-foreground">
							/{derivedSlug || "..."}
						</p>
					</div>
				</div>
				<div className="px-6 py-8 md:px-8 md:py-10">
					<form onSubmit={onSubmit} className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor={nameId}>{t("team.nameLabel")}</Label>
							<Input
								id={nameId}
								placeholder={t("team.namePlaceholder")}
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="calm-input-surface h-12"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={slugId}>{t("team.slugLabel")}</Label>
							<Input
								id={slugId}
								placeholder={t("team.slugPlaceholder")}
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								className="calm-input-surface h-12"
							/>
							<p className="text-xs text-muted-foreground">
								{t("team.slugWillUsePrefix")}{" "}
								<span className="font-mono text-foreground">
									{derivedSlug || ""}
								</span>
							</p>
						</div>
						{error && (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						)}
						<div className="pt-2">
							<Button
								type="submit"
								disabled={submitting}
								size="lg"
								className="rounded-full px-6"
							>
								{submitting
									? t("team.creatingEllipsis")
									: t("team.createButton")}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</section>
	);
}
