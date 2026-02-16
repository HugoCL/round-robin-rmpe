"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";

export type UserPreferences = {
	showAssignments: boolean;
	showTags: boolean;
	showEmails: boolean;
	hideMultiAssignmentSection: boolean;
	alwaysSendGoogleChatMessage: boolean;
};

const USER_PREFERENCE_DEFAULTS: UserPreferences = {
	showAssignments: false,
	showTags: true,
	showEmails: false,
	hideMultiAssignmentSection: false,
	alwaysSendGoogleChatMessage: false,
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
		a.showTags === b.showTags &&
		a.showEmails === b.showEmails &&
		a.hideMultiAssignmentSection === b.hideMultiAssignmentSection &&
		a.alwaysSendGoogleChatMessage === b.alwaysSendGoogleChatMessage
	);
}

function resolvePatch(
	patch: Partial<UserPreferences>,
): Partial<UserPreferences> {
	const resolved: Partial<UserPreferences> = {};

	if (typeof patch.showAssignments === "boolean") {
		resolved.showAssignments = patch.showAssignments;
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
	if (typeof patch.alwaysSendGoogleChatMessage === "boolean") {
		resolved.alwaysSendGoogleChatMessage = patch.alwaysSendGoogleChatMessage;
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

	const serverPreferences = useMemo<UserPreferences | null>(() => {
		if (!preferenceQuery) return null;
		return {
			showAssignments: preferenceQuery.showAssignments,
			showTags: preferenceQuery.showTags,
			showEmails: preferenceQuery.showEmails,
			hideMultiAssignmentSection: preferenceQuery.hideMultiAssignmentSection,
			alwaysSendGoogleChatMessage: preferenceQuery.alwaysSendGoogleChatMessage,
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
		async (patch: Partial<UserPreferences>) => {
			const resolvedPatch = resolvePatch(patch);
			if (Object.keys(resolvedPatch).length === 0) return;

			const previousPreferences = preferencesRef.current;
			const nextPreferences = {
				...previousPreferences,
				...resolvedPatch,
			};

			setOptimisticPreferences(nextPreferences);
			setIsSaving(true);
			try {
				await updatePreferencesMutation(resolvedPatch);
			} catch (error) {
				console.error("Failed to update user preferences:", error);
				setOptimisticPreferences(previousPreferences);
				toast({
					title: t("common.error"),
					description: t("mySettings.saveFailed"),
					variant: "destructive",
				});
			} finally {
				setIsSaving(false);
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
