"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useAppConfig } from "@/components/AppConfigProvider";
import { PageIntro } from "@/components/PageIntro";
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
					<PageIntro
						icon={<ShieldCheck aria-hidden="true" />}
						title={t("title")}
						description={t("subtitle")}
					/>

					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<div className="max-w-full min-w-0 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
							<TabsList>
								<TabsTrigger className="shrink-0" value="access">
									{t("tabs.access")}
								</TabsTrigger>
								<TabsTrigger className="shrink-0" value="teams">
									{t("tabs.teams")}
								</TabsTrigger>
								<TabsTrigger className="shrink-0" value="users">
									{t("tabs.users")}
								</TabsTrigger>
								<TabsTrigger className="shrink-0" value="announcements">
									{t("tabs.announcements")}
								</TabsTrigger>
								<TabsTrigger className="shrink-0" value="features">
									{t("tabs.features")}
								</TabsTrigger>
								<TabsTrigger className="shrink-0" value="ops">
									{t("tabs.ops")}
								</TabsTrigger>
								<TabsTrigger className="shrink-0" value="maintenance">
									{t("tabs.maintenance")}
								</TabsTrigger>
							</TabsList>
						</div>
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
