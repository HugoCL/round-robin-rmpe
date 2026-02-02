"use client";
import { MessageSquare, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { generatePRChatMessage } from "@/app/actions/generatePRChatMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface ChatMessageCustomizerProps {
	prUrl: string;
	onPrUrlChange: (v: string) => void;
	onPrUrlBlur?: () => void;
	contextUrl?: string;
	onContextUrlChange?: (v: string) => void;
	sendMessage: boolean;
	onSendMessageChange: (v: boolean) => void;
	enabled: boolean; // custom message enabled
	onEnabledChange: (v: boolean) => void;
	message: string;
	onMessageChange: (v: string) => void;
	nextReviewerName?: string | null;
	compact?: boolean; // hide modifiers & AI generation
	autoTemplate?: string;
}

export function ChatMessageCustomizer({
	prUrl,
	onPrUrlChange,
	onPrUrlBlur,
	contextUrl = "",
	onContextUrlChange,
	sendMessage,
	onSendMessageChange,
	enabled,
	onEnabledChange,
	message,
	onMessageChange,
	nextReviewerName,
	compact = false,
	autoTemplate,
}: ChatMessageCustomizerProps) {
	const t = useTranslations();
	const locale = useLocale();
	const prUrlId = useId();
	const contextUrlId = useId();
	const toggleCustomId = useId();
	const sendToggleId = useId();
	const [userEdited, setUserEdited] = useState(false);
	const [selectedMods, setSelectedMods] = useState<string[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
	const [_isPending, startTransition] = useTransition();

	const availableMods = [
		{
			id: "funny",
			label: locale.startsWith("es") ? "Divertido" : "Funny",
			emoji: "😄",
		},
		{
			id: "references",
			label: locale.startsWith("es") ? "Con Referencias" : "With References",
			emoji: "🎬",
		},
		{ id: "spanglish", label: "Spanglish", emoji: "🇺🇸🇪🇸" },
		{
			id: "formal",
			label: locale.startsWith("es") ? "Formal" : "Formal",
			emoji: "🎩",
		},
		{
			id: "motivational",
			label: locale.startsWith("es") ? "Motivacional" : "Motivational",
			emoji: "💪",
		},
		{
			id: "pirate",
			label: locale.startsWith("es") ? "Pirata" : "Pirate",
			emoji: "🏴\u200d☠️",
		},
	];

	const placeholdersHint = t("googleChat.placeholdersHint", {
		reviewer: "{{reviewer_name}}",
		requester: "{{requester_name}}",
		pr: "{{PR}}",
		defaultValue: "Use {reviewer}, {requester} and {pr}",
	});

	// Prefill template when enabling custom message
	useEffect(() => {
		if (sendMessage && enabled && !userEdited && !message.trim()) {
			if (autoTemplate) {
				onMessageChange(autoTemplate);
			} else if (nextReviewerName) {
				// Always use Spanish default template regardless of app locale
				const baseMessage = `Hola {{reviewer_name}} 👋\n{{requester_name}} te ha asignado la revisión de este <URL_PLACEHOLDER|PR>`;
				onMessageChange(baseMessage);
			}
		}
	}, [
		sendMessage,
		enabled,
		userEdited,
		message,
		autoTemplate,
		nextReviewerName,
		onMessageChange,
	]);

	const generateMessage = async () => {
		setIsGenerating(true);
		startTransition(async () => {
			try {
				const { response } = await generatePRChatMessage({
					mods: selectedMods.length ? selectedMods : undefined,
				});
				if (response) {
					onMessageChange(response);
					setUserEdited(true);
					setHasGeneratedOnce(true);
				}
			} catch (e) {
				console.warn("AI generation failed", e);
			} finally {
				setIsGenerating(false);
			}
		});
	};

	return (
		<div className="bg-muted/30  p-4 space-y-3 border border-muted/50">
			<div className="flex items-center justify-between">
				<Label
					htmlFor={sendToggleId}
					className="text-xs text-muted-foreground flex items-center gap-1"
				>
					<MessageSquare className="h-3 w-3" />{" "}
					{t("googleChat.sendMessageToggle", {
						defaultValue: locale.startsWith("es")
							? "Enviar mensaje"
							: "Send message",
					})}
				</Label>
				<Switch
					id={sendToggleId}
					checked={sendMessage}
					onCheckedChange={(v) => {
						onSendMessageChange(v);
						if (!v) {
							onEnabledChange(false);
							onMessageChange("");
							setUserEdited(false);
						}
					}}
				/>
			</div>

			{sendMessage && (
				<>
					<div className="space-y-1">
						<Label htmlFor={prUrlId} className="text-xs text-muted-foreground">
							{t("googleChat.prUrlLabel")}
						</Label>
						<Input
							id={prUrlId}
							placeholder={t("placeholders.githubPrUrl")}
							value={prUrl}
							onChange={(e) => onPrUrlChange(e.target.value)}
							onBlur={onPrUrlBlur}
							autoComplete="off"
							inputMode="url"
							spellCheck={false}
							data-form-autocomplete="off"
							className="text-sm"
						/>
					</div>

					<div className="space-y-1">
						<Label
							htmlFor={contextUrlId}
							className="text-xs text-muted-foreground"
						>
							{t("googleChat.contextUrlLabel", {
								defaultValue: "Context URL (optional)",
							})}
						</Label>
						<Input
							id={contextUrlId}
							placeholder={t("placeholders.contextUrl", {
								defaultValue: "https://...",
							})}
							value={contextUrl}
							onChange={(e) => onContextUrlChange?.(e.target.value)}
							autoComplete="off"
							inputMode="url"
							spellCheck={false}
							data-form-autocomplete="off"
							className="text-sm"
						/>
						{contextUrl?.trim() && (
							<p className="text-[10px] text-muted-foreground italic">
								{t("googleChat.contextUrlHint", {
									defaultValue: 'Will add a "Ver Contexto" button',
								})}
							</p>
						)}
					</div>

					<div className="pt-2 border-t border-muted/50 flex items-center justify-between">
						<Label
							htmlFor={toggleCustomId}
							className="text-xs text-muted-foreground flex items-center gap-1"
						>
							<MessageSquare className="h-3 w-3" />{" "}
							{t("googleChat.customizeToggle")}
						</Label>
						<Switch
							id={toggleCustomId}
							checked={enabled}
							onCheckedChange={(val) => {
								onEnabledChange(val);
								if (!val) {
									onMessageChange("");
									setUserEdited(false);
								}
							}}
						/>
					</div>

					{enabled && (
						<div className="space-y-2 pt-2">
							<textarea
								className="w-full text-sm  border bg-background p-2 resize-none h-28"
								value={message}
								onChange={(e) => {
									onMessageChange(e.target.value);
									setUserEdited(true);
								}}
								placeholder={t("googleChat.textareaPlaceholder")}
							/>

							{!compact && (
								<>
									<div className="space-y-2">
										<Label className="text-xs text-muted-foreground">
											{t("modifiers.styleModifiers")}
										</Label>
										<div className="flex flex-wrap gap-2">
											{availableMods.map((mod) => {
												const isActive = selectedMods.includes(mod.id);
												return (
													<Badge
														key={mod.id}
														variant={isActive ? "default" : "outline"}
														className="cursor-pointer hover:bg-primary/80 transition-colors text-xs"
														onClick={() => {
															setSelectedMods((prev) =>
																prev.includes(mod.id)
																	? prev.filter((m) => m !== mod.id)
																	: [...prev, mod.id],
															);
														}}
													>
														<span className="mr-1">{mod.emoji}</span>
														{mod.label}
													</Badge>
												);
											})}
										</div>
									</div>

									<div className="flex flex-wrap gap-2 items-center">
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={
												isGenerating || !prUrl.trim() || !nextReviewerName
											}
											onClick={() => {
												setUserEdited(false);
												generateMessage();
											}}
										>
											{isGenerating ? (
												<>
													<Sparkles className="h-3 w-3 mr-1 animate-pulse" />{" "}
													{t("googleChat.generating")}
												</>
											) : (
												<>
													<Sparkles className="h-3 w-3 mr-1" />
													{hasGeneratedOnce
														? t("googleChat.generateNew")
														: t("googleChat.generate")}
												</>
											)}
										</Button>
									</div>
								</>
							)}

							<p className="text-[10px] text-muted-foreground leading-snug">
								{placeholdersHint}
							</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
