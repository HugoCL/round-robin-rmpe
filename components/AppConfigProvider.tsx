"use client";

import { useQuery } from "convex/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { AppFeatureKey, FeatureState } from "@/lib/appFeatures";
import type { EmailAccessPolicy } from "@/lib/appSettings";
import { DEFAULT_EMAIL_ACCESS } from "@/lib/appSettings";

type AppConfig = {
	/** False until the first response lands. Optional UI should render nothing until then. */
	isReady: boolean;
	isAuthenticated: boolean;
	isAdmin: boolean;
	emailAccess: EmailAccessPolicy;
	canAccessApp: boolean;
	features: Partial<Record<AppFeatureKey, FeatureState>>;
};

const FALLBACK: AppConfig = {
	isReady: false,
	isAuthenticated: false,
	isAdmin: false,
	emailAccess: DEFAULT_EMAIL_ACCESS,
	canAccessApp: false,
	features: {},
};

const AppConfigContext = createContext<AppConfig>(FALLBACK);

/**
 * One subscription to the runtime configuration for the whole tab.
 *
 * Mounted above every page so the board, /admin, /surveys, /suggestions and
 * /metrics share it. None of those share PRReviewContext, so without this each
 * would issue its own query.
 */
export function AppConfigProvider({ children }: { children: ReactNode }) {
	const config = useQuery(api.appConfig.getRuntimeConfig);

	const value = useMemo<AppConfig>(() => {
		if (!config) return FALLBACK;
		return {
			isReady: true,
			isAuthenticated: config.isAuthenticated,
			isAdmin: config.isAdmin,
			emailAccess: config.emailAccess,
			canAccessApp: config.canAccessApp,
			features: config.features,
		};
	}, [config]);

	return (
		<AppConfigContext.Provider value={value}>
			{children}
		</AppConfigContext.Provider>
	);
}

export function useAppConfig(): AppConfig {
	return useContext(AppConfigContext);
}

/**
 * Whether a feature should render.
 *
 * Returns false until the config lands: showing optional UI and then pulling it
 * away produces a visible flash, so additive surfaces render nothing while the
 * answer is unknown.
 */
export function useFeatureEnabled(key: AppFeatureKey): boolean {
	const { isReady, features } = useAppConfig();
	if (!isReady) return false;
	return features[key]?.enabled === true;
}
