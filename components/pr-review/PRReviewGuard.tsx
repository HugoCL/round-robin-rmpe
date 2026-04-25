"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

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

	if (isLoading || !isLoaded || !isUserPreferencesReady || !hasAccessContext) {
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

	if (!isAuthenticated) {
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

	if (userEmail && !/^.+@buk\.[a-zA-Z0-9-]+$/.test(userEmail)) {
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
