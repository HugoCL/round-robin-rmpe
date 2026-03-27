"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePRReview } from "./PRReviewContext";

export function ForeignTeamAssignmentCard() {
	const t = useTranslations();
	const { nextReviewer, assignPR } = usePRReview();
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [urgent, setUrgent] = useState(false);
	const [isAssigning, setIsAssigning] = useState(false);

	const handleAssign = async () => {
		if (!nextReviewer || isAssigning) return;
		setIsAssigning(true);
		try {
			await assignPR({
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
				urgent,
			});
			setPrUrl("");
			setContextUrl("");
			setUrgent(false);
		} finally {
			setIsAssigning(false);
		}
	};

	return (
		<section className="page-enter-soft rounded-2xl border border-border/70 bg-card/70 p-4">
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{t("team.foreignTeamPromptTitle")}
				</p>
				<p className="text-sm text-muted-foreground">
					{t("team.foreignTeamPromptDescription")}
				</p>
			</div>
			<div className="mt-4 grid gap-3">
				<Input
					value={prUrl}
					onChange={(event) => setPrUrl(event.target.value)}
					placeholder={t("placeholders.githubPrUrl")}
				/>
				<Input
					value={contextUrl}
					onChange={(event) => setContextUrl(event.target.value)}
					placeholder={t("placeholders.contextUrl")}
				/>
				<div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2">
					<Switch
						id="foreign-team-urgent"
						checked={urgent}
						onCheckedChange={setUrgent}
					/>
					<Label htmlFor="foreign-team-urgent">{t("pr.urgent")}</Label>
				</div>
				<Button
					onClick={handleAssign}
					disabled={!nextReviewer || isAssigning}
					className="rounded-full"
				>
					{isAssigning
						? t("common.loading")
						: nextReviewer
							? t("team.assignToVisitedTeamCta", {
									reviewer: nextReviewer.name,
								})
							: t("pr.noAvailableReviewers")}
				</Button>
			</div>
		</section>
	);
}
