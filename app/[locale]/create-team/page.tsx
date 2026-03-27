"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import CreateTeamForm from "@/components/CreateTeamForm";

export default function CreateTeamPage() {
	const t = useTranslations();
	const locale = useLocale();
	return (
		<div className="relative min-h-screen overflow-hidden">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_60%)]"
			/>
			<div className="container mx-auto px-4 py-6">
				<Link
					href={`/${locale}`}
					className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
				>
					{t("team.backHome")}
				</Link>
			</div>
			<div className="page-enter-soft relative flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 pb-10">
				<CreateTeamForm />
			</div>
		</div>
	);
}
