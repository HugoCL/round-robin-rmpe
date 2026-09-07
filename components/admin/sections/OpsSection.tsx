"use client";

import { useMutation, useQuery } from "convex/react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";
import { OPS_BOUNDS, type OpsSettings } from "@/lib/appSettings";

const NUMERIC_KEYS = [
	"retentionDays",
	"assignmentFeedLength",
	"backupsPerTeam",
	"debugMessageLimit",
	"defaultEventDurationMinutes",
	"birthdayNotifyLocalHour",
] as const;

export function OpsSection() {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();
	const timezoneId = useId();

	const settings = useQuery(api.appSettings.getSettings, {});
	const updateOps = useMutation(api.appSettings.updateOps);

	const [values, setValues] = useState<Record<string, string>>({});
	const [timezone, setTimezone] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!settings) return;
		const ops = settings.resolved.ops;
		setValues(
			Object.fromEntries(
				NUMERIC_KEYS.map((key) => [key, String(ops[key] ?? "")]),
			),
		);
		setTimezone(ops.defaultTeamTimezone ?? "");
	}, [settings]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const payload: Partial<OpsSettings> = {};
			for (const key of NUMERIC_KEYS) {
				const parsed = Number(values[key]);
				if (Number.isFinite(parsed)) payload[key] = parsed;
			}
			await updateOps({
				...payload,
				defaultTeamTimezone: timezone.trim() || undefined,
			});
			toast({ title: t("ops.saved") });
		} catch (error) {
			showError(error);
		} finally {
			setIsSaving(false);
		}
	};

	if (settings === undefined) {
		return (
			<AdminSectionShell
				title={t("ops.title")}
				description={t("ops.description")}
			>
				<Skeleton className="h-64 w-full" />
			</AdminSectionShell>
		);
	}

	return (
		<AdminSectionShell
			title={t("ops.title")}
			description={t("ops.description")}
		>
			<div className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2">
					{NUMERIC_KEYS.map((key) => {
						const bounds = OPS_BOUNDS[key];
						const inputId = `ops-${key}`;
						return (
							<div key={key} className="space-y-1.5">
								<label
									htmlFor={inputId}
									className="text-sm font-medium text-muted-foreground"
								>
									{t(`ops.fields.${key}`)}
								</label>
								<Input
									id={inputId}
									type="number"
									inputMode="numeric"
									min={bounds.min}
									max={bounds.max}
									value={values[key] ?? ""}
									onChange={(event) =>
										setValues((prev) => ({
											...prev,
											[key]: event.target.value,
										}))
									}
								/>
								<p className="text-xs text-muted-foreground">
									{t("ops.range", { min: bounds.min, max: bounds.max })}
								</p>
							</div>
						);
					})}
					<div className="space-y-1.5">
						<label
							htmlFor={timezoneId}
							className="text-sm font-medium text-muted-foreground"
						>
							{t("ops.fields.defaultTeamTimezone")}
						</label>
						<Input
							id={timezoneId}
							value={timezone}
							className="font-mono"
							placeholder="America/Santiago"
							onChange={(event) => setTimezone(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							{t("ops.timezoneHint")}
						</p>
					</div>
				</div>

				<div className="flex justify-end">
					<Button
						type="button"
						disabled={isSaving}
						onClick={() => void handleSave()}
					>
						<SlidersHorizontal aria-hidden="true" />
						{isSaving ? tCommon("common.saving") : tCommon("common.save")}
					</Button>
				</div>
			</div>
		</AdminSectionShell>
	);
}
