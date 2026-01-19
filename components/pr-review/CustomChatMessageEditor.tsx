"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Lightweight reusable editor for (PR URL + custom Google Chat message) used across dialogs.
 * This intentionally omits the AI generation & style modifiers from AssignmentCard
 * to keep dialogs compact. If needed we can extend via props later.
 */
export interface CustomChatMessageEditorProps {
	enabled: boolean;
	onEnabledChange: (v: boolean) => void;
	prUrl: string;
	onPrUrlChange: (v: string) => void;
	message: string;
	onMessageChange: (v: string) => void;
	autoTemplate?: string; // default template when enabling
	className?: string;
}

export function CustomChatMessageEditor({
	enabled,
	onEnabledChange,
	prUrl,
	onPrUrlChange,
	message,
	onMessageChange,
	autoTemplate,
	className,
}: CustomChatMessageEditorProps) {
	const t = useTranslations();
	const toggleId = useId();
	const prUrlId = useId();
	const [userEdited, setUserEdited] = useState(false);

	useEffect(() => {
		if (enabled && !userEdited && !message.trim() && autoTemplate) {
			onMessageChange(autoTemplate);
		}
	}, [enabled, userEdited, message, autoTemplate, onMessageChange]);

	return (
		<div className={className}>
			<div className="space-y-2">
				<div className="space-y-1">
					<Label htmlFor={prUrlId} className="text-xs text-muted-foreground">
						{t("googleChat.prUrlLabel")}
					</Label>
					<Input
						id={prUrlId}
						value={prUrl}
						onChange={(e) => onPrUrlChange(e.target.value)}
						placeholder={t("placeholders.githubPrUrl")}
						spellCheck={false}
						inputMode="url"
						className="h-8 text-sm"
					/>
				</div>

				<div className="pt-2 border-t border-muted/50 flex items-center justify-between">
					<Label
						htmlFor={toggleId}
						className="text-xs text-muted-foreground flex items-center gap-1"
					>
						<MessageSquare className="h-3 w-3" />{" "}
						{t("googleChat.customizeToggle")}
					</Label>
					<Switch
						id={toggleId}
						checked={enabled}
						onCheckedChange={(v) => {
							onEnabledChange(v);
							if (!v) {
								onMessageChange("");
								setUserEdited(false);
							}
						}}
					/>
				</div>

				{enabled && (
					<textarea
						className="w-full text-sm  border bg-background p-2 resize-none h-24"
						value={message}
						onChange={(e) => {
							onMessageChange(e.target.value);
							setUserEdited(true);
						}}
						placeholder={t("googleChat.textareaPlaceholder")}
					/>
				)}
				{enabled && (
					<p className="text-[10px] text-muted-foreground leading-snug">
						{t("googleChat.placeholdersHint", {
							reviewer: "{{reviewer_name}}",
							requester: "{{requester_name}}",
							pr: "{{PR}}",
							defaultValue: "Use {reviewer}, {requester} and {pr}",
						})}
					</p>
				)}
			</div>
		</div>
	);
}
