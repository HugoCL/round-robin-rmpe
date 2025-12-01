"use client";

import { useMutation, useQuery } from "convex/react";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";

interface TeamSettingsDialogProps {
	teamSlug?: string;
	trigger?: React.ReactNode;
}

export function TeamSettingsDialog({
	teamSlug,
	trigger,
}: TeamSettingsDialogProps) {
	const t = useTranslations();
	const webhookUrlId = useId();
	const [open, setOpen] = useState(false);
	const [webhookUrl, setWebhookUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");
	const updateTeamSettings = useMutation(api.mutations.updateTeamSettings);

	// Initialize webhook URL when team data loads
	useEffect(() => {
		if (team?.googleChatWebhookUrl) {
			setWebhookUrl(team.googleChatWebhookUrl);
		} else {
			setWebhookUrl("");
		}
	}, [team?.googleChatWebhookUrl]);

	const handleSave = async () => {
		if (!teamSlug) {
			toast({
				title: t("common.error"),
				description: t("messages.missingTeam"),
				variant: "destructive",
			});
			return;
		}

		setIsSaving(true);
		try {
			await updateTeamSettings({
				teamSlug,
				googleChatWebhookUrl: webhookUrl.trim() || undefined,
			});
			toast({
				title: t("common.success"),
				description: t("teamSettings.webhookSaved"),
			});
			setOpen(false);
		} catch (error) {
			console.error("Failed to save team settings:", error);
			toast({
				title: t("common.error"),
				description: t("teamSettings.saveFailed"),
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	if (!teamSlug) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" size="sm">
						<Settings className="h-4 w-4 mr-2" />
						{t("teamSettings.title")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{t("teamSettings.title")}</DialogTitle>
					<DialogDescription>{t("teamSettings.description")}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor={webhookUrlId}>
							{t("teamSettings.webhookUrlLabel")}
						</Label>
						<Input
							id={webhookUrlId}
							type="url"
							placeholder={t("teamSettings.webhookUrlPlaceholder")}
							value={webhookUrl}
							onChange={(e) => setWebhookUrl(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							{t("teamSettings.webhookUrlHint")}
						</p>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleSave} disabled={isSaving}>
						{isSaving ? t("common.saving") : t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
