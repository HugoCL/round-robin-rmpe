"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SecondaryPageNav } from "@/components/SecondaryPageNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading and unauthorized states for the admin console, matching the shape
 * SurveysAdminPage established for admin-only routes.
 */
export function AdminGate({
	isReady,
	isAdmin,
	children,
}: {
	isReady: boolean;
	isAdmin: boolean;
	children: ReactNode;
}) {
	const t = useTranslations("admin");
	const tCommon = useTranslations();
	const locale = useLocale();

	if (!isReady) {
		return (
			<>
				<SecondaryPageNav />
				<main className="container mx-auto max-w-5xl px-4 py-8">
					<Skeleton className="h-10 w-48" />
					<Skeleton className="mt-6 h-40 w-full" />
				</main>
			</>
		);
	}

	if (!isAdmin) {
		return (
			<>
				<SecondaryPageNav />
				<main className="container mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
					<div className="calm-section page-enter w-full max-w-xl space-y-3 text-center">
						<p className="calm-kicker">La Lista</p>
						<h1 className="text-2xl font-semibold tracking-tight">
							{t("unauthorizedTitle")}
						</h1>
						<p className="text-muted-foreground">
							{t("unauthorizedDescription")}
						</p>
						<div className="flex justify-center pt-1">
							<Button asChild variant="outline" className="rounded-full">
								<Link href={`/${locale}`}>{tCommon("team.backHome")}</Link>
							</Button>
						</div>
					</div>
				</main>
			</>
		);
	}

	return <>{children}</>;
}
