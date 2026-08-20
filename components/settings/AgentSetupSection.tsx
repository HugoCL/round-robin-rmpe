"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
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
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-medium">{title}</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
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
			<pre className="w-full overflow-x-auto rounded-2xl border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-6 text-foreground">
				<code>{code}</code>
			</pre>
			{disabled && disabledHint ? (
				<p className="text-xs text-muted-foreground">{disabledHint}</p>
			) : null}
		</div>
	);
}

function StepHeading({ step, title }: { step: number; title: string }) {
	return (
		<div className="flex items-center gap-3">
			<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
				{step}
			</span>
			<h3 className="text-sm font-semibold">{title}</h3>
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
		<Tabs defaultValue="connect" className="w-full">
			<TabsList variant="line" className="w-full justify-start">
				<TabsTrigger value="connect">{t("agentSetup.connectTab")}</TabsTrigger>
				<TabsTrigger value="tokens">
					{t("agentSetup.tokensTab")}
					{activeTokens.length > 0 ? (
						<span className="ml-1.5 text-xs text-muted-foreground">
							{activeTokens.length}
						</span>
					) : null}
				</TabsTrigger>
			</TabsList>

			<TabsContent value="connect" className="mt-5 space-y-7">
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>{t("agentSetup.capabilityAssign")}</li>
					<li>{t("agentSetup.capabilityContext")}</li>
					<li>{t("agentSetup.capabilityFlags")}</li>
				</ul>

				<section className="space-y-3">
					<StepHeading step={1} title={t("agentSetup.defaultTeamLabel")} />
					<div className="space-y-2">
						<Label htmlFor="default-agent-team" className="sr-only">
							{t("agentSetup.defaultTeamLabel")}
						</Label>
						<Select
							value={defaultTeamSlug || "__none__"}
							onValueChange={(value) => {
								void handleDefaultTeamChange(value);
							}}
						>
							<SelectTrigger id="default-agent-team">
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
						<p className="text-xs text-muted-foreground">
							{t("agentSetup.defaultTeamDescription")}
						</p>
					</div>
				</section>

				<section className="space-y-3">
					<StepHeading step={2} title={t("agentSetup.generateTokenTitle")} />
					<div className="space-y-3">
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
						{revealedToken ? (
							<div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
								<p className="text-xs font-medium text-primary">
									{t("agentSetup.tokenRevealTitle")}
								</p>
								<pre className="overflow-x-auto font-mono text-xs leading-6 text-foreground">
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
					</div>
				</section>

				<section className="space-y-3">
					<StepHeading step={3} title={t("agentSetup.installTitle")} />
					<p className="text-sm text-muted-foreground">
						{t("agentSetup.installDescription")}
					</p>
					<CodeSnippet
						title={t("agentSetup.mcpInstallCommandTitle")}
						code={claudeMcpInstallCommand}
						onCopy={() =>
							void copyText("mcp-install-command", claudeMcpInstallCommand)
						}
						copied={copiedSnippet === "mcp-install-command"}
						copyLabel={t("agentSetup.copySnippet")}
						copiedLabel={t("agentSetup.copiedSnippet")}
						disabled={!hasFreshToken}
						disabledHint={t("agentSetup.commandNeedsToken")}
					/>
					<ol className="space-y-2">
						{[
							t("agentSetup.mcpInstallStepOne"),
							t("agentSetup.mcpInstallStepTwo"),
							t("agentSetup.mcpInstallStepThree"),
						].map((step, index) => (
							<li
								key={step}
								className="flex gap-3 text-sm text-muted-foreground"
							>
								<span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-[11px] font-semibold text-foreground">
									{index + 1}
								</span>
								<span>{step}</span>
							</li>
						))}
					</ol>
				</section>

				{isSaving ? (
					<p className="text-xs text-muted-foreground">
						{t("agentSetup.saving")}
					</p>
				) : null}
			</TabsContent>

			<TabsContent value="tokens" className="mt-5 space-y-3">
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
								className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between"
							>
								<div className="space-y-1">
									<p className="text-sm font-medium">{token.label}</p>
									<p className="font-mono text-xs text-muted-foreground">
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
