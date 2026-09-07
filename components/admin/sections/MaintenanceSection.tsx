"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { ConfirmDestructiveDialog } from "@/components/admin/ConfirmDestructiveDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";

export function MaintenanceSection() {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();

	const data = useQuery(api.adminOps.listMaintenanceTasks, {});
	const migrationData = useQuery(api.adminOps.listMigrations, {});
	const runTask = useAction(api.adminOps.runMaintenanceTask);
	const startMigration = useMutation(api.adminOps.startMigration);

	const [pending, setPending] = useState<string | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [lastResult, setLastResult] = useState<string | null>(null);

	const execute = async (task: string) => {
		setPending(task);
		try {
			const result = await runTask({ task });
			setLastResult(JSON.stringify(result.result ?? null, null, 1));
			toast({ title: t("maintenance.ran"), description: task });
		} catch (error) {
			showError(error);
		} finally {
			setPending(null);
			setConfirming(null);
		}
	};

	const runMigration = async (name: string, dryRun: boolean) => {
		setPending(name);
		try {
			const result = await startMigration({ name, dryRun });
			setLastResult(JSON.stringify(result, null, 1));
			toast({
				// A dry run rolls back by throwing, which the mutation reports as
				// a success. Say which of the two actually happened.
				title: dryRun ? t("maintenance.dryRanTitle") : t("maintenance.ran"),
				description: name,
			});
		} catch (error) {
			showError(error);
		} finally {
			setPending(null);
		}
	};

	if (data === undefined || migrationData === undefined) {
		return (
			<AdminSectionShell
				title={t("maintenance.title")}
				description={t("maintenance.description")}
			>
				<Skeleton className="h-64 w-full" />
			</AdminSectionShell>
		);
	}

	return (
		<>
			<AdminSectionShell
				title={t("maintenance.title")}
				description={t("maintenance.description")}
			>
				<div className="space-y-5">
					<div className="space-y-2">
						<p className="calm-kicker">{t("maintenance.tasksHeading")}</p>
						<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
							{data.tasks.map((task) => (
								<li
									key={task.key}
									className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate font-mono text-sm">{task.key}</p>
										<p className="text-pretty text-xs text-muted-foreground">
											{t(`maintenance.tasks.${task.key}`)}
										</p>
									</div>
									{task.destructive ? (
										<Badge variant="secondary">
											{t("maintenance.destructive")}
										</Badge>
									) : null}
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={pending !== null}
										onClick={() =>
											task.destructive
												? setConfirming(task.key)
												: void execute(task.key)
										}
									>
										<Play aria-hidden="true" />
										{t("maintenance.run")}
									</Button>
								</li>
							))}
						</ul>
					</div>

					<div className="space-y-2">
						<p className="calm-kicker">{t("maintenance.migrationsHeading")}</p>
						<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
							{migrationData.names.map((name) => (
								<li
									key={name}
									className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3"
								>
									<p className="min-w-0 flex-1 truncate font-mono text-sm">
										{name}
									</p>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={pending !== null}
										onClick={() => void runMigration(name, true)}
									>
										{t("maintenance.dryRun")}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={pending !== null}
										onClick={() => void runMigration(name, false)}
									>
										{t("maintenance.apply")}
									</Button>
								</li>
							))}
						</ul>
						<p className="text-xs text-muted-foreground">
							{t("maintenance.migrationsHint")}
						</p>
					</div>

					{lastResult ? (
						<div className="calm-subtle-panel space-y-2 p-4">
							<p className="text-sm font-medium">
								{t("maintenance.lastResult")}
							</p>
							<pre className="max-h-64 overflow-auto font-mono text-xs">
								{lastResult}
							</pre>
						</div>
					) : null}

					{data.runs.length > 0 ? (
						<div className="space-y-2">
							<p className="calm-kicker">{t("maintenance.historyHeading")}</p>
							<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
								{data.runs.map((run) => (
									<li
										key={run._id}
										className="flex min-h-12 flex-wrap items-center gap-2 px-4 py-2"
									>
										<span className="min-w-0 flex-1 truncate font-mono text-xs">
											{run.task}
										</span>
										<Badge
											variant={
												run.status === "succeeded" ? "secondary" : "destructive"
											}
										>
											{t(`maintenance.status.${run.status}`)}
										</Badge>
										<span className="text-xs text-muted-foreground">
											{new Date(run.startedAt).toLocaleString()}
										</span>
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			</AdminSectionShell>

			<ConfirmDestructiveDialog
				open={confirming !== null}
				title={t("maintenance.confirmTitle")}
				description={t("maintenance.confirmDescription", {
					task: confirming ?? "",
				})}
				confirmWord={confirming ?? ""}
				confirmLabel={tCommon("common.confirm")}
				onOpenChange={(open) => {
					if (!open) setConfirming(null);
				}}
				onConfirm={() => {
					if (confirming) void execute(confirming);
				}}
			/>
		</>
	);
}
