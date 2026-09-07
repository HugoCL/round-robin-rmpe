"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useAppConfig } from "@/components/AppConfigProvider";
import { SecondaryPageNav } from "@/components/SecondaryPageNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminGate } from "./AdminGate";
import { AccessSection } from "./sections/AccessSection";
import { AnnouncementsSection } from "./sections/AnnouncementsSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { MaintenanceSection } from "./sections/MaintenanceSection";
import { OpsSection } from "./sections/OpsSection";
import { TeamsSection } from "./sections/TeamsSection";
import { UsersSection } from "./sections/UsersSection";

const TABS = [
	"access",
	"teams",
	"users",
	"announcements",
	"features",
	"ops",
	"maintenance",
] as const;
type AdminTab = (typeof TABS)[number];

function isAdminTab(value: string | null): value is AdminTab {
	return value !== null && TABS.includes(value as AdminTab);
}

function AdminConsoleContent() {
	const t = useTranslations("admin");
	const router = useRouter();
	const searchParams = useSearchParams();
	const { isReady, isAdmin } = useAppConfig();

	// The active tab lives in the URL so a link to a section is shareable and
	// a refresh does not bounce back to the first tab.
	const requested = searchParams.get("tab");
	const activeTab: AdminTab = isAdminTab(requested) ? requested : "access";

	const handleTabChange = (value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", value);
		router.replace(`?${params.toString()}`, { scroll: false });
	};

	return (
		<AdminGate isReady={isReady} isAdmin={isAdmin}>
			<SecondaryPageNav />
			<main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
				<div className="space-y-6">
					<header className="page-enter-soft space-y-2">
						<p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
							<ShieldCheck className="h-4 w-4" aria-hidden="true" />
							La Lista
						</p>
						<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
							{t("title")}
						</h1>
						<p className="max-w-2xl text-pretty text-muted-foreground">
							{t("subtitle")}
						</p>
					</header>

					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<TabsList>
							<TabsTrigger value="access">{t("tabs.access")}</TabsTrigger>
							<TabsTrigger value="teams">{t("tabs.teams")}</TabsTrigger>
							<TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
							<TabsTrigger value="announcements">
								{t("tabs.announcements")}
							</TabsTrigger>
							<TabsTrigger value="features">{t("tabs.features")}</TabsTrigger>
							<TabsTrigger value="ops">{t("tabs.ops")}</TabsTrigger>
							<TabsTrigger value="maintenance">
								{t("tabs.maintenance")}
							</TabsTrigger>
						</TabsList>
						<TabsContent value="access" className="pt-4">
							<AccessSection />
						</TabsContent>
						<TabsContent value="teams" className="pt-4">
							<TeamsSection />
						</TabsContent>
						<TabsContent value="users" className="pt-4">
							<UsersSection />
						</TabsContent>
						<TabsContent value="announcements" className="pt-4">
							<AnnouncementsSection />
						</TabsContent>
						<TabsContent value="features" className="pt-4">
							<FeaturesSection />
						</TabsContent>
						<TabsContent value="ops" className="pt-4">
							<OpsSection />
						</TabsContent>
						<TabsContent value="maintenance" className="pt-4">
							<MaintenanceSection />
						</TabsContent>
					</Tabs>
				</div>
			</main>
		</AdminGate>
	);
}

export function AdminConsolePage() {
	return (
		// useSearchParams needs a Suspense boundary to avoid opting the whole
		// route into client-side rendering at build time.
		<Suspense fallback={null}>
			<AdminConsoleContent />
		</Suspense>
	);
}
