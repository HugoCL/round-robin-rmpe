"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";
import { APP_FEATURES, mergeFeatureStates } from "@/lib/appFeatures";

export function FeaturesSection() {
	const t = useTranslations("admin");
	const _tCommon = useTranslations();
	const showError = useAdminErrorToast();

	const config = useQuery(api.appConfig.getRuntimeConfig);
	const setFeatureToggle = useMutation(api.appSettings.setFeatureToggle);

	// Convex is blind to Next-server env vars, so the web side reports its own
	// missing keys and the two views are merged here.
	const [webMissing, setWebMissing] = useState<string[] | null>(null);
	const [pendingKey, setPendingKey] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/admin/runtime-status")
			.then((response) => (response.ok ? response.json() : { missing: [] }))
			.then((data) => {
				if (!cancelled) setWebMissing(data.missing ?? []);
			})
			.catch(() => {
				if (!cancelled) setWebMissing([]);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleToggle = async (key: string, enabled: boolean) => {
		setPendingKey(key);
		try {
			await setFeatureToggle({ key, enabled });
		} catch (error) {
			showError(error);
		} finally {
			setPendingKey(null);
		}
	};

	if (config === undefined || webMissing === null) {
		return (
			<AdminSectionShell
				title={t("features.title")}
				description={t("features.description")}
			>
				<Skeleton className="h-64 w-full" />
			</AdminSectionShell>
		);
	}

	const states = mergeFeatureStates(config.features, new Set(webMissing));

	return (
		<AdminSectionShell
			title={t("features.title")}
			description={t("features.description")}
		>
			<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
				{APP_FEATURES.map((feature) => {
					const state = states[feature.key];
					if (!state) return null;
					const switchId = `feature-${feature.key}`;
					return (
						<li
							key={feature.key}
							className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-3"
						>
							<div className="min-w-0 flex-1 space-y-0.5">
								<label htmlFor={switchId} className="text-sm font-medium">
									{t(`features.names.${feature.key}`)}
								</label>
								<p className="text-pretty text-xs text-muted-foreground">
									{t(`features.hints.${feature.key}`)}
								</p>
								{/* A toggle cannot conjure an API key. Say which one is
								    missing instead of silently showing the switch as on. */}
								{!state.requirementsMet ? (
									<p className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
										<AlertTriangle
											className="size-3.5 shrink-0"
											aria-hidden="true"
										/>
										{t("features.missingRequirements")}
										{state.missingRequirements.map((envVar) => (
											<code key={envVar} className="font-mono text-[0.7rem]">
												{envVar}
											</code>
										))}
									</p>
								) : null}
							</div>
							{state.toggle && !state.requirementsMet ? (
								<Badge variant="secondary">{t("features.inactive")}</Badge>
							) : null}
							<Switch
								id={switchId}
								checked={state.toggle}
								disabled={pendingKey === feature.key}
								onCheckedChange={(checked) =>
									void handleToggle(feature.key, checked)
								}
								aria-label={t(`features.names.${feature.key}`)}
							/>
						</li>
					);
				})}
			</ul>
		</AdminSectionShell>
	);
}
