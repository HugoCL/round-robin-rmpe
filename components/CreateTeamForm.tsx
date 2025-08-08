"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
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
				setError("Please provide a team name.");
				setSubmitting(false);
				return;
			}
			await createTeam({ name: name.trim(), slug: finalSlug });
			router.replace(`/${locale}/${finalSlug}`);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to create team";
			setError(message);
			setSubmitting(false);
		}
	};

	return (
		<div className="container mx-auto py-10 max-w-xl">
			<Card>
				<CardHeader>
					<CardTitle>Create your first team</CardTitle>
					<CardDescription>
						Teams let you keep reviewers, tags, and history separate while
						sharing the same database.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="team-name">Team name</Label>
							<Input
								id="team-name"
								placeholder="e.g. Platform, Mobile, Infra"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="team-slug">Team slug (URL)</Label>
							<Input
								id="team-slug"
								placeholder="auto-generated from name"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Will use: <span className="font-mono">{derivedSlug || ""}</span>
							</p>
						</div>
						{error && (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						)}
						<div className="pt-2">
							<Button type="submit" disabled={submitting}>
								{submitting ? "Creating…" : "Create team"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
