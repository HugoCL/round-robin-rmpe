"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	Check,
	Copy,
	Download,
	KeyRound,
	Link as LinkIcon,
	Shield,
	Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
	renderClaudeInstallCommand,
	renderClaudeSettingsJsonSnippet,
	renderShellEnvSnippet,
} from "@/lib/agent-skill-spec";

function CodeSnippet({
	title,
	code,
	onCopy,
	copied,
	copyLabel,
	copiedLabel,
}: {
	title: string;
	code: string;
	onCopy: () => void;
	copied: boolean;
	copyLabel: string;
	copiedLabel: string;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-medium">{title}</p>
				<Button type="button" variant="outline" size="sm" onClick={onCopy}>
					{copied ? (
						<Check className="mr-2 h-4 w-4" />
					) : (
						<Copy className="mr-2 h-4 w-4" />
					)}
					{copied ? copiedLabel : copyLabel}
				</Button>
			</div>
			<pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-6 text-foreground">
				<code>{code}</code>
			</pre>
		</div>
	);
}

export function AgentSetupSection() {
	const t = useTranslations();
	const locale = useLocale();
	const teams = useQuery(api.agent.getMyTeams, {}) ?? [];
	const tokens = useQuery(api.agent.getMyAgentTokens, {}) ?? [];
	const createToken = useAction(api.agent.createMyAgentToken);
	const revokeToken = useMutation(api.agent.revokeMyAgentToken);
	const { preferences, updatePreferences, isSaving } = useUserPreferences();

	const [origin, setOrigin] = useState("");
	const [tokenLabel, setTokenLabel] = useState("");
	const [revealedToken, setRevealedToken] = useState<string | null>(null);
	const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
	const [isGeneratingToken, startGenerateTransition] = useTransition();
	const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);

	useEffect(() => {
		setOrigin(window.location.origin);
	}, []);

	const defaultTeamSlug = preferences.defaultAgentTeamSlug;
	const shellSnippet = useMemo(
		() =>
			renderShellEnvSnippet({
				baseUrl: origin || "https://la-lista.example.com",
				defaultTeamSlug,
				tokenPlaceholder: revealedToken || "paste-your-personal-token-here",
			}),
		[defaultTeamSlug, origin, revealedToken],
	);
	const settingsSnippet = useMemo(
		() =>
			renderClaudeSettingsJsonSnippet({
				baseUrl: origin || "https://la-lista.example.com",
				defaultTeamSlug,
				tokenPlaceholder: revealedToken || "paste-your-personal-token-here",
			}),
		[defaultTeamSlug, origin, revealedToken],
	);
	const installCommand = useMemo(
		() =>
			renderClaudeInstallCommand({
				baseUrl: origin || "https://la-lista.example.com",
				defaultTeamSlug,
			}),
		[defaultTeamSlug, origin],
	);

	const formatDate = (value?: number) => {
		if (!value) return t("agentSetup.neverUsed");
		return new Intl.DateTimeFormat(locale, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	};

	const copyText = async (key: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopiedSnippet(key);
			window.setTimeout(() => {
				setCopiedSnippet((current) => (current === key ? null : current));
			}, 1800);
			toast({
				title: t("common.success"),
				description: t("agentSetup.copied"),
			});
		} catch (error) {
			console.error("Failed to copy snippet:", error);
			toast({
				title: t("common.error"),
				description: t("agentSetup.copyFailed"),
				variant: "destructive",
			});
		}
	};

	const handleDefaultTeamChange = async (value: string) => {
		await updatePreferences({
			defaultAgentTeamSlug: value === "__none__" ? null : value,
		});
	};

	const handleGenerateToken = () => {
		startGenerateTransition(async () => {
			try {
				const result = await createToken({
					label: tokenLabel.trim() || undefined,
				});
				setRevealedToken(result.rawToken);
				setTokenLabel("");
				toast({
					title: t("common.success"),
					description: t("agentSetup.tokenGenerated"),
				});
			} catch (error) {
				console.error("Failed to generate personal agent token:", error);
				toast({
					title: t("common.error"),
					description: t("agentSetup.tokenGenerateFailed"),
					variant: "destructive",
				});
			}
		});
	};

	const handleRevokeToken = async (tokenId: string) => {
		setRevokingTokenId(tokenId);
		try {
			await revokeToken({
				tokenId: tokenId as never,
			});
			toast({
				title: t("common.success"),
				description: t("agentSetup.tokenRevoked"),
			});
		} catch (error) {
			console.error("Failed to revoke token:", error);
			toast({
				title: t("common.error"),
				description: t("agentSetup.tokenRevokeFailed"),
				variant: "destructive",
			});
		} finally {
			setRevokingTokenId(null);
		}
	};

	return (
		<div className="space-y-5">
			<div className="space-y-2">
				<Label htmlFor="default-agent-team">
					{t("agentSetup.defaultTeamLabel")}
				</Label>
				<Select
					value={defaultTeamSlug || "__none__"}
					onValueChange={(value) => {
						void handleDefaultTeamChange(value);
					}}
				>
					<SelectTrigger id="default-agent-team">
						<SelectValue placeholder={t("agentSetup.defaultTeamPlaceholder")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">
							{t("agentSetup.noDefaultTeam")}
						</SelectItem>
						{teams.map((team) => (
							<SelectItem key={String(team.id)} value={team.slug}>
								{team.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-xs text-muted-foreground">
					{t("agentSetup.defaultTeamDescription")}
				</p>
			</div>

			<Accordion
				type="multiple"
				className="overflow-hidden rounded-2xl border bg-muted/10 p-2"
			>
				<AccordionItem
					value="tokens"
					className="border-border/60 rounded-xl px-4 md:px-5"
				>
					<AccordionTrigger className="px-1 py-5 text-sm hover:no-underline">
						<div className="flex items-start gap-3 text-left">
							<div className="mt-0.5 rounded-full border border-primary/20 bg-primary/5 p-2 text-primary">
								<Shield className="h-4 w-4" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">
									{t("agentSetup.tokenSectionTitle")}
								</p>
								<p className="text-xs text-muted-foreground">
									{t("agentSetup.tokenSectionDescription")}
								</p>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-1 pb-5 text-sm">
						<div className="space-y-6">
							<div className="rounded-2xl border bg-muted/20 p-4">
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<KeyRound className="h-4 w-4 text-primary" />
										<p className="text-sm font-medium">
											{t("agentSetup.generateTokenTitle")}
										</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="agent-token-label">
											{t("agentSetup.tokenLabel")}
										</Label>
										<Input
											id="agent-token-label"
											value={tokenLabel}
											onChange={(event) => setTokenLabel(event.target.value)}
											placeholder={t("agentSetup.tokenLabelPlaceholder")}
										/>
									</div>
									<div className="flex flex-wrap items-center gap-3">
										<Button
											type="button"
											onClick={handleGenerateToken}
											disabled={isGeneratingToken}
										>
											<KeyRound className="mr-2 h-4 w-4" />
											{isGeneratingToken
												? t("agentSetup.generatingToken")
												: t("agentSetup.generateToken")}
										</Button>
										<p className="text-xs text-muted-foreground">
											{t("agentSetup.tokenOnceHint")}
										</p>
									</div>
									{revealedToken && (
										<div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
											<p className="text-xs font-medium text-primary">
												{t("agentSetup.tokenRevealTitle")}
											</p>
											<pre className="overflow-x-auto text-xs leading-6 text-foreground">
												<code>{revealedToken}</code>
											</pre>
											<div className="flex flex-wrap gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() =>
														void copyText("raw-token", revealedToken)
													}
												>
													<Copy className="mr-2 h-4 w-4" />
													{t("agentSetup.copyToken")}
												</Button>
											</div>
										</div>
									)}
								</div>
							</div>

							<div className="space-y-3">
								<p className="text-sm font-medium">
									{t("agentSetup.activeTokensTitle")}
								</p>
								<div className="space-y-3">
									{tokens.length === 0 ? (
										<div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
											{t("agentSetup.noTokens")}
										</div>
									) : (
										tokens.map((token) => (
											<div
												key={String(token.id)}
												className="rounded-xl border bg-card/70 p-4"
											>
												<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
													<div className="space-y-1">
														<p className="text-sm font-medium">{token.label}</p>
														<p className="text-xs text-muted-foreground">
															{token.tokenPrefix}
														</p>
														<p className="text-xs text-muted-foreground">
															{t("agentSetup.createdAt", {
																date: formatDate(token.createdAt),
															})}
														</p>
														<p className="text-xs text-muted-foreground">
															{t("agentSetup.lastUsedAt", {
																date: formatDate(token.lastUsedAt),
															})}
														</p>
														{token.revokedAt && (
															<p className="text-xs font-medium text-destructive">
																{t("agentSetup.revokedAt", {
																	date: formatDate(token.revokedAt),
																})}
															</p>
														)}
													</div>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() =>
															void handleRevokeToken(String(token.id))
														}
														disabled={
															Boolean(token.revokedAt) ||
															revokingTokenId === String(token.id)
														}
													>
														<Trash2 className="mr-2 h-4 w-4" />
														{revokingTokenId === String(token.id)
															? t("agentSetup.revokingToken")
															: token.revokedAt
																? t("agentSetup.revoked")
																: t("agentSetup.revokeToken")}
													</Button>
												</div>
											</div>
										))
									)}
								</div>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem
					value="install"
					className="border-border/60 rounded-xl px-4 md:px-5"
				>
					<AccordionTrigger className="px-1 py-5 text-sm hover:no-underline">
						<div className="flex items-start gap-3 text-left">
							<div className="mt-0.5 rounded-full border border-primary/20 bg-primary/5 p-2 text-primary">
								<LinkIcon className="h-4 w-4" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">
									{t("agentSetup.installSectionTitle")}
								</p>
								<p className="text-xs text-muted-foreground">
									{t("agentSetup.installSectionDescription")}
								</p>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-1 pb-5 text-sm">
						<div className="space-y-6">
							<div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
								<div className="flex items-center gap-2">
									<LinkIcon className="h-4 w-4 text-primary" />
									<p className="text-sm font-medium">
										{t("agentSetup.installTitle")}
									</p>
								</div>
								<p className="text-sm text-muted-foreground">
									{t("agentSetup.installDescription")}
								</p>
								<CodeSnippet
									title={t("agentSetup.installCommandTitle")}
									code={installCommand}
									onCopy={() =>
										void copyText("install-command", installCommand)
									}
									copied={copiedSnippet === "install-command"}
									copyLabel={t("agentSetup.copySnippet")}
									copiedLabel={t("agentSetup.copiedSnippet")}
								/>
								<p className="text-xs text-muted-foreground">
									{t("agentSetup.installCommandDescription")}
								</p>
								<ul className="space-y-2 text-sm text-muted-foreground">
									<li>{t("agentSetup.installStepOne")}</li>
									<li>{t("agentSetup.installStepTwo")}</li>
									<li>{t("agentSetup.installStepThree")}</li>
								</ul>
								<div className="flex flex-wrap gap-3 pt-2">
									<Button asChild>
										<a
											href={`/api/settings/agent/claude-subagent?defaultTeamSlug=${encodeURIComponent(
												defaultTeamSlug || "",
											)}`}
										>
											<Download className="mr-2 h-4 w-4" />
											{t("agentSetup.downloadClaude")}
										</a>
									</Button>
									<Button asChild variant="outline">
										<a
											href={`/api/settings/agent/universal-spec?defaultTeamSlug=${encodeURIComponent(
												defaultTeamSlug || "",
											)}`}
										>
											<Download className="mr-2 h-4 w-4" />
											{t("agentSetup.downloadSpec")}
										</a>
									</Button>
								</div>
							</div>

							<div className="space-y-4">
								<CodeSnippet
									title={t("agentSetup.shellSnippetTitle")}
									code={shellSnippet}
									onCopy={() => void copyText("shell", shellSnippet)}
									copied={copiedSnippet === "shell"}
									copyLabel={t("agentSetup.copySnippet")}
									copiedLabel={t("agentSetup.copiedSnippet")}
								/>
								<CodeSnippet
									title={t("agentSetup.settingsSnippetTitle")}
									code={settingsSnippet}
									onCopy={() => void copyText("settings", settingsSnippet)}
									copied={copiedSnippet === "settings"}
									copyLabel={t("agentSetup.copySnippet")}
									copiedLabel={t("agentSetup.copiedSnippet")}
								/>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			{isSaving ? (
				<p className="text-xs text-muted-foreground">
					{t("agentSetup.saving")}
				</p>
			) : null}
		</div>
	);
}
