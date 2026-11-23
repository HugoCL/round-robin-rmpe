"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { normalizeWidgetLayout, type WidgetLayout } from "@/lib/widgetLayout";

export type UserPreferences = {
	showAssignments: boolean;
	myAssignmentsOnly: boolean;
	showTags: boolean;
	showEmails: boolean;
	hideMultiAssignmentSection: boolean;
	enableAgentSetupExperiment: boolean;
	defaultAgentTeamSlug?: string;
	/** undefined means never customised: render DEFAULT_WIDGET_LAYOUT. */
	widgetLayout?: WidgetLayout;
};

type UserPreferencePatch = Partial<
	Omit<UserPreferences, "defaultAgentTeamSlug" | "widgetLayout">
> & {
	defaultAgentTeamSlug?: string | null;
	widgetLayout?: WidgetLayout | null;
};

const USER_PREFERENCE_DEFAULTS: UserPreferences = {
	showAssignments: false,
	myAssignmentsOnly: false,
	showTags: true,
	showEmails: false,
	hideMultiAssignmentSection: false,
	enableAgentSetupExperiment: false,
	defaultAgentTeamSlug: undefined,
	widgetLayout: undefined,
};

const LEGACY_LOCAL_STORAGE_KEYS = [
	"showAssignments",
	"showTags",
	"showEmails",
] as const;

function parseLegacyBoolean(
	key: (typeof LEGACY_LOCAL_STORAGE_KEYS)[number],
	fallback: boolean,
): boolean {
	try {
		const storedValue = window.localStorage.getItem(key);
		if (!storedValue) return fallback;
		const parsed = JSON.parse(storedValue);
		return typeof parsed === "boolean" ? parsed : fallback;
	} catch {
		return fallback;
	}
}

function readLegacyLocalPreferences(): Pick<
	UserPreferences,
	"showAssignments" | "showTags" | "showEmails"
> {
	return {
		showAssignments: parseLegacyBoolean(
			"showAssignments",
			USER_PREFERENCE_DEFAULTS.showAssignments,
		),
		showTags: parseLegacyBoolean("showTags", USER_PREFERENCE_DEFAULTS.showTags),
		showEmails: parseLegacyBoolean(
			"showEmails",
			USER_PREFERENCE_DEFAULTS.showEmails,
		),
	};
}

function clearLegacyLocalPreferences() {
	for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
		try {
			window.localStorage.removeItem(key);
		} catch {
			// no-op
		}
	}
}

function isSamePreferenceState(a: UserPreferences, b: UserPreferences) {
	return (
		a.showAssignments === b.showAssignments &&
		a.myAssignmentsOnly === b.myAssignmentsOnly &&
		a.showTags === b.showTags &&
		a.showEmails === b.showEmails &&
		a.hideMultiAssignmentSection === b.hideMultiAssignmentSection &&
		a.enableAgentSetupExperiment === b.enableAgentSetupExperiment &&
		a.defaultAgentTeamSlug === b.defaultAgentTeamSlug &&
		JSON.stringify(a.widgetLayout?.lanes) ===
			JSON.stringify(b.widgetLayout?.lanes)
	);
}

function resolvePatch(patch: UserPreferencePatch): UserPreferencePatch {
	const resolved: UserPreferencePatch = {};

	if (typeof patch.showAssignments === "boolean") {
		resolved.showAssignments = patch.showAssignments;
	}
	if (typeof patch.myAssignmentsOnly === "boolean") {
		resolved.myAssignmentsOnly = patch.myAssignmentsOnly;
	}
	if (typeof patch.showTags === "boolean") {
		resolved.showTags = patch.showTags;
	}
	if (typeof patch.showEmails === "boolean") {
		resolved.showEmails = patch.showEmails;
	}
	if (typeof patch.hideMultiAssignmentSection === "boolean") {
		resolved.hideMultiAssignmentSection = patch.hideMultiAssignmentSection;
	}
	if (typeof patch.enableAgentSetupExperiment === "boolean") {
		resolved.enableAgentSetupExperiment = patch.enableAgentSetupExperiment;
	}
	if (patch.defaultAgentTeamSlug !== undefined) {
		resolved.defaultAgentTeamSlug = patch.defaultAgentTeamSlug;
	}
	if (patch.widgetLayout !== undefined) {
		resolved.widgetLayout = patch.widgetLayout;
	}

	return resolved;
}

export function useUserPreferences() {
	const t = useTranslations();
	const preferenceQuery = useQuery(api.queries.getMyUserPreferences, {});
	const bootstrapPreferences = useMutation(
		api.mutations.bootstrapMyUserPreferences,
	);
	const updatePreferencesMutation = useMutation(
		api.mutations.updateMyUserPreferences,
	);

	const [optimisticPreferences, setOptimisticPreferences] =
		useState<UserPreferences | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const didBootstrapRef = useRef(false);
	const pendingWritesRef = useRef(0);
	const writeFailedRef = useRef(false);

	const serverPreferences = useMemo<UserPreferences | null>(() => {
		if (!preferenceQuery) return null;
		return {
			showAssignments: preferenceQuery.showAssignments,
			myAssignmentsOnly: preferenceQuery.myAssignmentsOnly === true,
			showTags: preferenceQuery.showTags,
			showEmails: preferenceQuery.showEmails,
			hideMultiAssignmentSection: preferenceQuery.hideMultiAssignmentSection,
			enableAgentSetupExperiment:
				preferenceQuery.enableAgentSetupExperiment === true,
			defaultAgentTeamSlug: preferenceQuery.defaultAgentTeamSlug,
			widgetLayout: preferenceQuery.widgetLayout
				? normalizeWidgetLayout(preferenceQuery.widgetLayout)
				: undefined,
		};
	}, [preferenceQuery]);

	const preferences =
		optimisticPreferences ?? serverPreferences ?? USER_PREFERENCE_DEFAULTS;
	const preferencesRef = useRef(preferences);

	useEffect(() => {
		preferencesRef.current = preferences;
	}, [preferences]);

	useEffect(() => {
		if (!serverPreferences) return;
		setOptimisticPreferences((current) => {
			if (!current) return null;
			return isSamePreferenceState(current, serverPreferences) ? null : current;
		});
	}, [serverPreferences]);

	useEffect(() => {
		if (!preferenceQuery) return;
		if (
			!preferenceQuery.isAuthenticated ||
			preferenceQuery.exists ||
			didBootstrapRef.current
		) {
			return;
		}

		didBootstrapRef.current = true;
		const legacyPreferences = readLegacyLocalPreferences();

		void (async () => {
			try {
				const result = await bootstrapPreferences(legacyPreferences);
				if (result.success) {
					clearLegacyLocalPreferences();
				}
			} catch (error) {
				console.error("Failed to bootstrap user preferences:", error);
				toast({
					title: t("common.error"),
					description: t("mySettings.bootstrapFailed"),
					variant: "destructive",
				});
			}
		})();
	}, [bootstrapPreferences, preferenceQuery, t]);

	const updatePreferences = useCallback(
		async (patch: UserPreferencePatch) => {
			const resolvedPatch = resolvePatch(patch);
			if (Object.keys(resolvedPatch).length === 0) return;

			const previousPreferences = preferencesRef.current;
			const nextPreferences = {
				...previousPreferences,
				...resolvedPatch,
				defaultAgentTeamSlug:
					resolvedPatch.defaultAgentTeamSlug === null
						? undefined
						: (resolvedPatch.defaultAgentTeamSlug ??
							previousPreferences.defaultAgentTeamSlug),
				widgetLayout:
					resolvedPatch.widgetLayout === null
						? undefined
						: (resolvedPatch.widgetLayout ?? previousPreferences.widgetLayout),
			};

			// The next patch may come before this one renders.
			preferencesRef.current = nextPreferences;
			setOptimisticPreferences(nextPreferences);
			pendingWritesRef.current += 1;
			setIsSaving(true);
			try {
				await updatePreferencesMutation(resolvedPatch);
			} catch (error) {
				console.error("Failed to update user preferences:", error);
				writeFailedRef.current = true;
				toast({
					title: t("common.error"),
					description: t("mySettings.saveFailed"),
					variant: "destructive",
				});
			} finally {
				pendingWritesRef.current -= 1;
				if (pendingWritesRef.current === 0) {
					setIsSaving(false);
					// A failed write must not take a later, saved one down with it:
					// once nothing is in flight, show what the server has.
					if (writeFailedRef.current) {
						writeFailedRef.current = false;
						setOptimisticPreferences(null);
					}
				}
			}
		},
		[t, updatePreferencesMutation],
	);

	return {
		preferences,
		isReady: preferenceQuery !== undefined,
		isSaving,
		updatePreferences,
	};
}
