"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
	getAgeDays,
	getStalenessLevel,
	type StalenessLevel,
} from "@/components/feature-flags/featureFlagAge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";

type FeatureFlagCardItem = {
	_id: Id<"featureFlags">;
	key: string;
	description?: string;
	status: "active" | "removed";
	createdAt: number;
	removedAt?: number;
	createdBy: {
		authorName: string;
	};
};

type FeatureFlagCardProps = {
	flag: FeatureFlagCardItem;
	locale: string;
	canManage: boolean;
	removing: boolean;
	onRemove: (featureFlagId: Id<"featureFlags">) => Promise<void>;
};

function stalenessVariant(
	level: StalenessLevel,
): "default" | "secondary" | "destructive" | "outline" {
	if (level === "stale") return "destructive";
	if (level === "aging") return "secondary";
	return "outline";
}

export function FeatureFlagCard({
	flag,
	locale,
	canManage,
	removing,
	onRemove,
}: FeatureFlagCardProps) {
	const t = useTranslations();

	const ageDays = useMemo(() => getAgeDays(flag.createdAt), [flag.createdAt]);
	const staleness = useMemo(() => getStalenessLevel(ageDays), [ageDays]);

	const formattedDate = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(flag.createdAt);

	const formattedRemovedDate =
		flag.removedAt != null
			? new Intl.DateTimeFormat(locale, {
					year: "numeric",
					month: "short",
					day: "numeric",
				}).format(flag.removedAt)
			: null;

	return (
		<article className="group px-4 py-4 transition-colors hover:bg-muted/30 md:px-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<code className="rounded-md bg-muted px-2 py-1 font-mono text-sm font-semibold text-foreground">
							{flag.key}
						</code>
						{flag.status === "removed" ? (
							<Badge variant="outline">
								{t("featureFlags.status.removed")}
							</Badge>
						) : (
							<Badge variant={stalenessVariant(staleness)}>
								{t(`featureFlags.staleness.${staleness}`, { days: ageDays })}
							</Badge>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						{flag.status === "removed" && formattedRemovedDate
							? t("featureFlags.removedBy", {
									name: flag.createdBy.authorName,
									createdDate: formattedDate,
									removedDate: formattedRemovedDate,
								})
							: t("featureFlags.createdBy", {
									name: flag.createdBy.authorName,
									date: formattedDate,
								})}
					</p>
					{flag.description ? (
						<p className="max-w-xl text-sm leading-6 text-muted-foreground">
							{flag.description}
						</p>
					) : null}
					{flag.status === "active" && staleness === "stale" ? (
						<p className="text-sm font-medium text-destructive">
							{t("featureFlags.staleHint")}
						</p>
					) : null}
				</div>
				{canManage && flag.status === "active" ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								disabled={removing}
								className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
							>
								<Trash2 className="h-4 w-4" />
								{t("featureFlags.remove")}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{t("featureFlags.confirmRemoveTitle")}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{t("featureFlags.confirmRemoveDescription", {
										key: flag.key,
									})}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
								<AlertDialogAction
									onClick={() => void onRemove(flag._id)}
									disabled={removing}
								>
									{removing
										? t("common.removing")
										: t("featureFlags.confirmRemoveAction")}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null}
			</div>
		</article>
	);
}
