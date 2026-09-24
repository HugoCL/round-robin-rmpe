"use client";

import { useConvexAuth } from "convex/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAppConfig } from "@/components/AppConfigProvider";
import { Button } from "@/components/ui/button";
import { resolveAccessGateState } from "@/lib/accessGate";

type PRReviewGuardProps = {
	isLoading: boolean;
	isLoaded: boolean;
	isUserPreferencesReady: boolean;
	hasAccessContext: boolean;
	isAuthenticated: boolean;
	userEmail?: string;
	onSignOut: () => Promise<void>;
	children: ReactNode;
};

export function PRReviewGuard({
	isLoading,
	isLoaded,
	isUserPreferencesReady,
	hasAccessContext,
	isAuthenticated,
	userEmail,
	onSignOut,
	children,
}: PRReviewGuardProps) {
	const t = useTranslations();
	const appConfig = useAppConfig();
	const convexAuth = useConvexAuth();

	const state = resolveAccessGateState({
		clerkLoaded: isLoaded,
		hasClerkUser: isAuthenticated,
		convexAuthLoading: convexAuth.isLoading,
		convexAuthenticated: convexAuth.isAuthenticated,
		configReady: appConfig.isReady,
		configAuthenticated: appConfig.isAuthenticated,
		// The rule lives in the appSettings singleton and is resolved
		// server-side, so the console can widen access without a redeploy.
		// Admins always pass.
		canAccessApp: appConfig.canAccessApp,
		dataReady: !isLoading && isUserPreferencesReady && hasAccessContext,
	});

	if (state === "loading") {
		return (
			<div className="container mx-auto flex h-[50vh] items-center justify-center px-4 py-6">
				<div className="calm-section max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h2 className="text-xl font-semibold mb-2">{t("common.loading")}</h2>
					<p className="text-muted-foreground">{t("pr.loadingPleaseWait")}</p>
				</div>
			</div>
		);
	}

	if (state === "signedOut") {
		return (
			<div className="container mx-auto flex h-[50vh] items-center justify-center px-4 py-6">
				<div className="calm-section max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h2 className="text-xl font-semibold mb-2">
						{t("you-are-not-authenticated")}
					</h2>
					<p className="text-muted-foreground">{t("pr.pleaseSignIn")}</p>
				</div>
			</div>
		);
	}

	if (state === "sessionUnverified") {
		return (
			<div className="container mx-auto flex h-[50vh] items-center justify-center px-4 py-6">
				<div className="calm-section max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h2 className="text-xl font-semibold mb-2">
						{t("pr.sessionUnverifiedTitle")}
					</h2>
					<p className="text-muted-foreground">
						{t("pr.sessionUnverifiedDescription")}
					</p>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						<Button
							type="button"
							className="rounded-full px-5"
							onClick={() => window.location.reload()}
						>
							{t("pr.sessionUnverifiedRetry")}
						</Button>
						<Button
							type="button"
							variant="outline"
							className="rounded-full px-5"
							onClick={() => void onSignOut()}
						>
							{t("pr.signOut")}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	if (state === "forbidden") {
		return (
			<div className="container mx-auto flex h-[50vh] items-center justify-center px-4 py-6">
				<div className="calm-section max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h2 className="text-xl font-semibold mb-2">
						{t("pr.notAuthorizedTitle")}
					</h2>
					<p className="text-muted-foreground">
						{t("pr.notAuthorizedDescription")} {t("pr.unauthorized")}{" "}
						{userEmail}
					</p>
					<form
						action={async () => {
							await onSignOut();
						}}
					>
						<Button type="submit" className="rounded-full px-5">
							{t("pr.signOut")}
						</Button>
					</form>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
