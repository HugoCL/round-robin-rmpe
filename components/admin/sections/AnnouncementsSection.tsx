"use client";

import { useMutation, useQuery } from "convex/react";
import { Megaphone, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";
import { AnnouncementEditor } from "./AnnouncementEditor";

type AnnouncementRow = Doc<"announcements"> & { isBuiltIn: boolean };

export function AnnouncementsSection() {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();

	const data = useQuery(api.announcements.listAll, {});
	const deleteAnnouncement = useMutation(api.announcements.deleteAnnouncement);
	const resetDismissals = useMutation(api.announcements.resetDismissals);
	const seedBuiltIns = useMutation(api.announcements.seedBuiltInAnnouncements);

	const [editing, setEditing] = useState<AnnouncementRow | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);

	const runWithToast = async (
		action: () => Promise<unknown>,
		successTitle: string,
	) => {
		try {
			await action();
			toast({ title: successTitle });
		} catch (error) {
			showError(error);
		}
	};

	if (data === undefined) {
		return (
			<AdminSectionShell
				title={t("announcements.title")}
				description={t("announcements.description")}
			>
				<Skeleton className="h-48 w-full" />
			</AdminSectionShell>
		);
	}

	const hasBuiltIns = data.announcements.some((row) => row.isBuiltIn);

	return (
		<>
			<AdminSectionShell
				title={t("announcements.title")}
				description={t("announcements.description")}
				action={
					<div className="flex flex-wrap gap-2">
						{!hasBuiltIns ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									void runWithToast(
										() => seedBuiltIns({ dryRun: false }),
										t("announcements.seeded"),
									)
								}
							>
								{t("announcements.seedBuiltIns")}
							</Button>
						) : null}
						<Button type="button" size="sm" onClick={() => setIsCreating(true)}>
							<Plus aria-hidden="true" />
							{t("announcements.create")}
						</Button>
					</div>
				}
			>
				{data.announcements.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Megaphone aria-hidden="true" />
							</EmptyMedia>
							<EmptyDescription>{t("announcements.empty")}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
						{data.announcements.map((row) => (
							<li
								key={row._id}
								className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3"
							>
								<div className="min-w-0 flex-1 space-y-1">
									<p className="truncate text-sm font-medium">
										{row.isBuiltIn
											? t("announcements.builtInBody", { key: row.key })
											: (row.bodyEs ?? row.bodyEn)}
									</p>
									<p className="truncate font-mono text-xs text-muted-foreground">
										{row.key}
									</p>
								</div>
								<Badge
									variant={row.status === "published" ? "default" : "secondary"}
								>
									{t(`announcements.status.${row.status}`)}
								</Badge>
								{row.audience !== "everyone" ? (
									<Badge variant="secondary">
										{t(`announcements.audience.${row.audience}`)}
									</Badge>
								) : null}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setEditing(row as AnnouncementRow)}
								>
									{tCommon("common.edit")}
								</Button>
								{/* Republishing a key that people already dismissed reaches
								    nobody until their dismissals are cleared. */}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={pendingId === row._id}
									onClick={() => {
										setPendingId(row._id);
										void runWithToast(
											() => resetDismissals({ key: row.key }),
											t("announcements.dismissalsReset"),
										).finally(() => setPendingId(null));
									}}
									aria-label={t("announcements.resetDismissals")}
								>
									<RotateCcw aria-hidden="true" />
									<span className="sr-only">
										{t("announcements.resetDismissals")}
									</span>
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={pendingId === row._id}
									onClick={() => {
										setPendingId(row._id);
										void runWithToast(
											() => deleteAnnouncement({ id: row._id }),
											t("announcements.deleted"),
										).finally(() => setPendingId(null));
									}}
									aria-label={tCommon("common.delete")}
								>
									<Trash2 aria-hidden="true" />
									<span className="sr-only">{tCommon("common.delete")}</span>
								</Button>
							</li>
						))}
					</ul>
				)}
			</AdminSectionShell>

			<AnnouncementEditor
				open={isCreating || editing !== null}
				announcement={editing}
				teams={data.teams}
				onOpenChange={(open) => {
					if (!open) {
						setIsCreating(false);
						setEditing(null);
					}
				}}
			/>
		</>
	);
}
