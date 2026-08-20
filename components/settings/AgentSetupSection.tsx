"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { McpUsageExamples } from "@/components/settings/McpUsageExamples";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
	buildClaudeMcpInstallCommand,
	DEFAULT_MCP_ORIGIN,
} from "@/lib/agent-mcp-install";
import { setAgentSetupDialogOpen } from "@/lib/agent-setup-dialog-store";
import { cn } from "@/lib/utils";

function CodeSnippet({
	title,
	code,
	onCopy,
	copied,
	copyLabel,
	copiedLabel,
	disabled,
	disabledHint,
}: {
	title: string;
	code: string;
	onCopy: () => void;
	copied: boolean;
	copyLabel: string;
	copiedLabel: string;
	disabled?: boolean;
	disabledHint?: string;
}) {
	return (
		<div className="min-w-0 w-full space-y-2">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<p className="min-w-0 text-sm font-medium">{title}</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="shrink-0 self-start"
					onClick={onCopy}
					disabled={disabled}
				>
					{copied ? (
						<Check className="mr-2 h-4 w-4" />
					) : (
						<Copy className="mr-2 h-4 w-4" />
					)}
					{copied ? copiedLabel : copyLabel}
				</Button>
			</div>
			<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-6 text-foreground">
				<code>{code}</code>
			</pre>
			{disabled && disabledHint ? (
				<p className="text-xs text-muted-foreground">{disabledHint}</p>
			) : null}
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
	const [activeStep, setActiveStep] = useState(1);
	const [isGeneratingToken, startGenerateTransition] = useTransition();
	const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);

	useEffect(() => {
		setOrigin(window.location.origin);
	}, []);

	const defaultTeamSlug = preferences.defaultAgentTeamSlug;
	const mcpOrigin = origin || DEFAULT_MCP_ORIGIN;
	const hasFreshToken = Boolean(revealedToken);
	const claudeMcpInstallCommand = useMemo(
		() =>
			buildClaudeMcpInstallCommand(
				mcpOrigin,
				revealedToken ?? t("agentSetup.commandTokenPlaceholder"),
			),
		[mcpOrigin, revealedToken, t],
	);
	const activeTokens = tokens.filter((token) => !token.revokedAt);
	const wizardSteps = [
		t("agentSetup.wizardTeam"),
		t("agentSetup.wizardToken"),
		t("agentSetup.wizardConnect"),
	];

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
				setActiveStep(3);
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
		<Tabs defaultValue="connect" className="min-w-0 w-full">
			<TabsList
				variant="line"
				className="h-auto min-w-0 w-full max-w-full justify-start"
			>
				<TabsTrigger value="connect" className="flex-none">
					{t("agentSetup.connectTab")}
				</TabsTrigger>
				<TabsTrigger value="tokens" className="flex-none">
					{t("agentSetup.tokensTab")}
					{activeTokens.length > 0 ? (
						<span className="ml-1.5 text-xs text-muted-foreground">
							{activeTokens.length}
						</span>
					) : null}
				</TabsTrigger>
			</TabsList>

			<TabsContent value="connect" className="mt-5 min-w-0 space-y-4">
				<ol
					className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/45 p-1"
					aria-label={t("agentSetup.wizardProgress")}
				>
					{wizardSteps.map((label, index) => {
						const step = index + 1;
						const isComplete = step < activeStep;
						const isCurrent = step === activeStep;

						return (
							<li
								key={label}
								className={cn(
									"flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-xs font-medium transition-colors",
									isCurrent &&
										"bg-background text-foreground ring-1 ring-border/70",
									isComplete && "text-primary",
									!isCurrent && !isComplete && "text-muted-foreground",
								)}
								aria-current={isCurrent ? "step" : undefined}
							>
								<span
									className={cn(
										"flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
										isComplete &&
											"border-primary bg-primary text-primary-foreground",
										isCurrent && "border-primary/40 bg-primary/10 text-primary",
										!isCurrent &&
											!isComplete &&
											"border-border text-muted-foreground",
									)}
								>
									{isComplete ? <Check className="size-3" /> : step}
								</span>
								<span className="min-w-0 truncate">{label}</span>
							</li>
						);
					})}
				</ol>

				<section className="min-h-[19rem] rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5">
					{activeStep === 1 ? (
						<div className="flex min-h-[17rem] flex-col">
							<div className="space-y-2">
								<p className="calm-kicker">
									{t("agentSetup.wizardStep", { current: 1, total: 3 })}
								</p>
								<h3 className="text-lg font-semibold">
									{t("agentSetup.defaultTeamLabel")}
								</h3>
								<p className="max-w-[65ch] text-sm text-muted-foreground">
									{t("agentSetup.defaultTeamDescription")}
								</p>
							</div>
							<div className="mt-6 space-y-2">
								<Label htmlFor="default-agent-team" className="sr-only">
									{t("agentSetup.defaultTeamLabel")}
								</Label>
								<Select
									value={defaultTeamSlug || "__none__"}
									onValueChange={(value) => {
										void handleDefaultTeamChange(value);
									}}
								>
									<SelectTrigger
										id="default-agent-team"
										className="w-full min-w-0 max-w-full"
									>
										<SelectValue
											placeholder={t("agentSetup.defaultTeamPlaceholder")}
										/>
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
							</div>
							<div className="mt-auto flex justify-end pt-6">
								<Button type="button" onClick={() => setActiveStep(2)}>
									{t("common.next")}
								</Button>
							</div>
						</div>
					) : null}

					{activeStep === 2 ? (
						<div className="flex min-h-[17rem] flex-col">
							<div className="space-y-2">
								<p className="calm-kicker">
									{t("agentSetup.wizardStep", { current: 2, total: 3 })}
								</p>
								<h3 className="text-lg font-semibold">
									{t("agentSetup.generateTokenTitle")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("agentSetup.tokenOnceHint")}
								</p>
							</div>
							<div className="mt-6 space-y-2">
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
							{revealedToken ? (
								<div className="mt-4 space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
									<p className="text-xs font-medium text-primary">
										{t("agentSetup.tokenRevealTitle")}
									</p>
									<pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-foreground">
										<code>{revealedToken}</code>
									</pre>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void copyText("raw-token", revealedToken)}
									>
										<Copy className="mr-2 h-4 w-4" />
										{t("agentSetup.copyToken")}
									</Button>
								</div>
							) : null}
							<div className="mt-auto flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-between">
								<Button
									type="button"
									variant="outline"
									onClick={() => setActiveStep(1)}
								>
									{t("common.back")}
								</Button>
								{revealedToken ? (
									<Button type="button" onClick={() => setActiveStep(3)}>
										{t("common.next")}
									</Button>
								) : (
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
								)}
							</div>
						</div>
					) : null}

					{activeStep === 3 ? (
						<div className="flex min-h-[17rem] flex-col">
							<div className="space-y-2">
								<p className="calm-kicker">
									{t("agentSetup.wizardStep", { current: 3, total: 3 })}
								</p>
								<h3 className="text-lg font-semibold">
									{t("agentSetup.installTitle")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("agentSetup.installDescription")}
								</p>
							</div>
							<div className="mt-6">
								<CodeSnippet
									title={t("agentSetup.mcpInstallCommandTitle")}
									code={claudeMcpInstallCommand}
									onCopy={() =>
										void copyText(
											"mcp-install-command",
											claudeMcpInstallCommand,
										)
									}
									copied={copiedSnippet === "mcp-install-command"}
									copyLabel={t("agentSetup.copySnippet")}
									copiedLabel={t("agentSetup.copiedSnippet")}
									disabled={!hasFreshToken}
									disabledHint={t("agentSetup.commandNeedsToken")}
								/>
							</div>
							<ul className="mt-4 space-y-1.5">
								{[
									t("agentSetup.mcpInstallStepOne"),
									t("agentSetup.mcpInstallStepTwo"),
									t("agentSetup.mcpInstallStepThree"),
								].map((note) => (
									<li
										key={note}
										className="flex min-w-0 gap-2.5 text-sm text-muted-foreground"
									>
										<span
											className="mt-2 size-1.5 shrink-0 rounded-full bg-border"
											aria-hidden="true"
										/>
										<span className="min-w-0">{note}</span>
									</li>
								))}
							</ul>
							<div className="mt-6 border-t border-border/60 pt-6">
								<McpUsageExamples />
							</div>
							<div className="mt-auto flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-between">
								<Button
									type="button"
									variant="outline"
									onClick={() => setActiveStep(2)}
								>
									{t("common.back")}
								</Button>
								<Button
									type="button"
									onClick={() => setAgentSetupDialogOpen(false)}
								>
									<Check className="mr-2 h-4 w-4" />
									{t("common.finish")}
								</Button>
							</div>
						</div>
					) : null}
				</section>

				{isSaving ? (
					<p className="text-xs text-muted-foreground">
						{t("agentSetup.saving")}
					</p>
				) : null}
			</TabsContent>

			<TabsContent value="tokens" className="mt-5 min-w-0 space-y-3">
				<p className="text-sm text-muted-foreground">
					{t("agentSetup.tokenSectionDescription")}
				</p>
				{tokens.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
						<p>{t("agentSetup.noTokens")}</p>
						<p className="mt-1">{t("agentSetup.noTokensHint")}</p>
					</div>
				) : (
					<div className="calm-list">
						{tokens.map((token) => (
							<div
								key={String(token.id)}
								className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between"
							>
								<div className="min-w-0 space-y-1">
									<p className="text-sm font-medium">{token.label}</p>
									<p className="break-all font-mono text-xs text-muted-foreground">
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
									{token.revokedAt ? (
										<p className="text-xs font-medium text-destructive">
											{t("agentSetup.revokedAt", {
												date: formatDate(token.revokedAt),
											})}
										</p>
									) : null}
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="shrink-0 self-start"
									onClick={() => void handleRevokeToken(String(token.id))}
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
						))}
					</div>
				)}
			</TabsContent>
		</Tabs>
	);
}
