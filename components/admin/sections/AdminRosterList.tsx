"use client";

import { useMutation, useQuery } from "convex/react";
import { Lock, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";

export function AdminRosterList() {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();
	const emailId = useId();
	const noteId = useId();

	const roster = useQuery(api.appAdmins.listAdmins, {});
	const addAdmin = useMutation(api.appAdmins.addAdmin);
	const removeAdmin = useMutation(api.appAdmins.removeAdmin);
	const seedFromEnv = useMutation(api.appAdmins.seedAdminsFromEnv);

	const [email, setEmail] = useState("");
	const [note, setNote] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [pendingEmail, setPendingEmail] = useState<string | null>(null);

	const trimmedEmail = email.trim();
	const canSubmit = trimmedEmail.includes("@") && !isSaving;

	const handleAdd = async () => {
		if (!canSubmit) return;
		setIsSaving(true);
		try {
			const result = await addAdmin({
				email: trimmedEmail,
				note: note.trim() || undefined,
			});
			setEmail("");
			setNote("");
			toast({
				title: result.added ? t("admins.added") : t("admins.alreadyAdmin"),
				description: result.email,
			});
		} catch (error) {
			showError(error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleRemove = async (target: string) => {
		setPendingEmail(target);
		try {
			await removeAdmin({ email: target });
			toast({ title: t("admins.removed"), description: target });
		} catch (error) {
			showError(error);
		} finally {
			setPendingEmail(null);
		}
	};

	const handleSeed = async () => {
		setIsSaving(true);
		try {
			const result = await seedFromEnv({ dryRun: false });
			toast({
				title: t("admins.seeded"),
				description: t("admins.seededDetail", {
					created: result.created.length,
					skipped: result.skipped.length,
				}),
			});
		} catch (error) {
			showError(error);
		} finally {
			setIsSaving(false);
		}
	};

	const unseededEnvAdmins =
		roster?.envAdmins.filter(
			(envEmail) => !roster.admins.some((admin) => admin.email === envEmail),
		) ?? [];

	return (
		<AdminSectionShell
			title={t("admins.title")}
			description={t("admins.description")}
			action={
				unseededEnvAdmins.length > 0 ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isSaving}
						onClick={() => void handleSeed()}
					>
						{t("admins.seedFromEnv", { count: unseededEnvAdmins.length })}
					</Button>
				) : null
			}
		>
			<div className="calm-subtle-panel space-y-3 p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="min-w-0 flex-1 space-y-1.5">
						<label
							htmlFor={emailId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("admins.emailLabel")}
						</label>
						<Input
							id={emailId}
							type="email"
							inputMode="email"
							autoComplete="off"
							value={email}
							placeholder={t("admins.emailPlaceholder")}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
					<div className="min-w-0 flex-1 space-y-1.5">
						<label
							htmlFor={noteId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("admins.noteLabel")}
						</label>
						<Input
							id={noteId}
							value={note}
							placeholder={t("admins.notePlaceholder")}
							onChange={(event) => setNote(event.target.value)}
						/>
					</div>
					<Button
						type="button"
						disabled={!canSubmit}
						onClick={() => void handleAdd()}
					>
						<UserPlus aria-hidden="true" />
						{isSaving ? tCommon("common.saving") : t("admins.add")}
					</Button>
				</div>
			</div>

			{roster === undefined ? (
				<Skeleton className="h-32 w-full" />
			) : roster.admins.length === 0 && roster.envAdmins.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UserPlus aria-hidden="true" />
						</EmptyMedia>
						<EmptyDescription>{t("admins.empty")}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
					{unseededEnvAdmins.map((envEmail) => (
						<li
							key={`env-${envEmail}`}
							className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3"
						>
							<span className="min-w-0 flex-1 truncate font-mono text-sm">
								{envEmail}
							</span>
							<Badge variant="secondary" className="gap-1">
								<Lock className="size-3" aria-hidden="true" />
								{t("admins.fromEnv")}
							</Badge>
						</li>
					))}
					{roster.admins.map((admin) => {
						const isSelf = admin.email === roster.currentEmail;
						return (
							<li
								key={admin._id}
								className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate font-mono text-sm">{admin.email}</p>
									{admin.note ? (
										<p className="truncate text-xs text-muted-foreground">
											{admin.note}
										</p>
									) : null}
								</div>
								{isSelf ? (
									<Badge variant="secondary">{t("admins.you")}</Badge>
								) : null}
								{admin.alsoInEnv ? (
									<Badge variant="secondary" className="gap-1">
										<Lock className="size-3" aria-hidden="true" />
										{t("admins.fromEnv")}
									</Badge>
								) : null}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={pendingEmail === admin.email}
									onClick={() => void handleRemove(admin.email)}
									aria-label={t("admins.remove", { email: admin.email })}
								>
									<Trash2 aria-hidden="true" />
									<span className="sr-only sm:not-sr-only">
										{tCommon("common.delete")}
									</span>
								</Button>
							</li>
						);
					})}
				</ul>
			)}
		</AdminSectionShell>
	);
}
