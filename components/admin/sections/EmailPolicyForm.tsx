"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";
import type { EmailAccessMode } from "@/lib/appSettings";
import { isAllowedAppEmail } from "@/lib/emailAccess";

export function EmailPolicyForm() {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();
	const modeId = useId();
	const domainsId = useId();
	const patternId = useId();
	const previewId = useId();
	const clerkTestId = useId();

	const settings = useQuery(api.appSettings.getSettings, {});
	const updateEmailAccess = useMutation(api.appSettings.updateEmailAccess);

	const [mode, setMode] = useState<EmailAccessMode>("open");
	const [domainsText, setDomainsText] = useState("");
	const [pattern, setPattern] = useState("");
	const [allowClerkTestEmails, setAllowClerkTestEmails] = useState(false);
	const [previewEmail, setPreviewEmail] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	// Seed the form from the stored policy once it arrives.
	useEffect(() => {
		if (!settings) return;
		const policy = settings.resolved.emailAccess;
		setMode(policy.mode);
		setDomainsText((policy.allowedDomains ?? []).join("\n"));
		setPattern(policy.allowedEmailPattern ?? "");
		setAllowClerkTestEmails(policy.allowClerkTestEmails === true);
	}, [settings]);

	const domains = domainsText
		.split(/[\s,]+/)
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	const previewAllowed = previewEmail.trim()
		? isAllowedAppEmail(previewEmail, {
				mode,
				allowedDomains: domains,
				allowedEmailPattern: pattern,
				allowClerkTestEmails,
			})
		: null;

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await updateEmailAccess({
				mode,
				allowedDomains: mode === "domains" ? domains : undefined,
				allowedEmailPattern: mode === "pattern" ? pattern : undefined,
				allowClerkTestEmails,
			});
			toast({ title: t("emailAccess.saved") });
		} catch (error) {
			showError(error);
		} finally {
			setIsSaving(false);
		}
	};

	if (settings === undefined) {
		return (
			<AdminSectionShell
				title={t("emailAccess.title")}
				description={t("emailAccess.description")}
			>
				<Skeleton className="h-48 w-full" />
			</AdminSectionShell>
		);
	}

	return (
		<AdminSectionShell
			title={t("emailAccess.title")}
			description={t("emailAccess.description")}
		>
			<div className="space-y-4">
				{/* A misread policy denies everyone but admins, so it goes first. */}
				{settings.emailAccessEnvError ? (
					<Alert variant="destructive">
						<AlertTriangle aria-hidden="true" />
						<AlertTitle>{t("emailAccess.envErrorTitle")}</AlertTitle>
						<AlertDescription>{settings.emailAccessEnvError}</AlertDescription>
					</Alert>
				) : null}

				{/* "Open" is the fallback when no policy has ever been saved, which
				    is very different from an operator choosing it. Say so. */}
				{settings.emailAccessSource === "default" ? (
					<Alert>
						<AlertTriangle aria-hidden="true" />
						<AlertTitle>{t("emailAccess.unconfiguredTitle")}</AlertTitle>
						<AlertDescription>
							{t("emailAccess.unconfiguredDescription")}
						</AlertDescription>
					</Alert>
				) : null}

				{/* Saving here writes a row that permanently overrides the env var,
				    so the admin should know which one they are looking at. */}
				{settings.emailAccessSource === "environment" ? (
					<Alert>
						<ShieldCheck aria-hidden="true" />
						<AlertTitle>{t("emailAccess.fromEnvTitle")}</AlertTitle>
						<AlertDescription>
							{t("emailAccess.fromEnvDescription")}
						</AlertDescription>
					</Alert>
				) : null}

				<div className="space-y-1.5">
					<label
						htmlFor={modeId}
						className="text-sm font-medium text-muted-foreground"
					>
						{t("emailAccess.modeLabel")}
					</label>
					<Select
						value={mode}
						onValueChange={(value) => setMode(value as EmailAccessMode)}
					>
						<SelectTrigger id={modeId} className="w-full sm:w-72">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="open">{t("emailAccess.modeOpen")}</SelectItem>
							<SelectItem value="domains">
								{t("emailAccess.modeDomains")}
							</SelectItem>
							<SelectItem value="pattern">
								{t("emailAccess.modePattern")}
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						{mode === "open"
							? t("emailAccess.modeOpenHint")
							: mode === "domains"
								? t("emailAccess.modeDomainsHint")
								: t("emailAccess.modePatternHint")}
					</p>
				</div>

				{mode === "domains" ? (
					<div className="space-y-1.5">
						<label
							htmlFor={domainsId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("emailAccess.domainsLabel")}
						</label>
						<Textarea
							id={domainsId}
							rows={4}
							value={domainsText}
							placeholder={"acme.com\nacme.cl"}
							onChange={(event) => setDomainsText(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							{t("emailAccess.domainsHint")}
						</p>
					</div>
				) : null}

				{mode === "pattern" ? (
					<div className="space-y-1.5">
						<label
							htmlFor={patternId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("emailAccess.patternLabel")}
						</label>
						<Input
							id={patternId}
							value={pattern}
							className="font-mono"
							placeholder="^.+@acme\\.com$"
							onChange={(event) => setPattern(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							{t("emailAccess.patternHint")}
						</p>
					</div>
				) : null}

				<div className="calm-subtle-panel flex items-start gap-3 p-4">
					<Switch
						id={clerkTestId}
						checked={allowClerkTestEmails}
						onCheckedChange={setAllowClerkTestEmails}
					/>
					<div className="min-w-0 space-y-0.5">
						<label htmlFor={clerkTestId} className="text-sm font-medium">
							{t("emailAccess.clerkTestLabel")}
						</label>
						<p className="text-xs text-muted-foreground">
							{t("emailAccess.clerkTestHint")}
						</p>
					</div>
				</div>

				{/* Checking a real address before saving is the cheapest way to
				    avoid shipping a policy that excludes the team. */}
				<div className="space-y-1.5">
					<label
						htmlFor={previewId}
						className="text-sm font-medium text-muted-foreground"
					>
						{t("emailAccess.previewLabel")}
					</label>
					<Input
						id={previewId}
						type="email"
						inputMode="email"
						value={previewEmail}
						placeholder={t("emailAccess.previewPlaceholder")}
						onChange={(event) => setPreviewEmail(event.target.value)}
					/>
					{previewAllowed === null ? null : (
						<p
							className={
								previewAllowed
									? "text-xs font-medium text-primary"
									: "text-xs font-medium text-destructive"
							}
						>
							{previewAllowed
								? t("emailAccess.previewAllowed")
								: t("emailAccess.previewBlocked")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						{t("emailAccess.adminBypassHint")}
					</p>
				</div>

				<div className="flex justify-end">
					<Button
						type="button"
						disabled={isSaving}
						onClick={() => void handleSave()}
					>
						<ShieldCheck aria-hidden="true" />
						{isSaving ? tCommon("common.saving") : tCommon("common.save")}
					</Button>
				</div>
			</div>
		</AdminSectionShell>
	);
}
