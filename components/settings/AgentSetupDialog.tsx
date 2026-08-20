"use client";

import { useTranslations } from "next-intl";
import { AgentSetupSection } from "@/components/settings/AgentSetupSection";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	setAgentSetupDialogOpen,
	useAgentSetupDialogOpen,
} from "@/lib/agent-setup-dialog-store";

function AgentSetupBody() {
	return <AgentSetupSection />;
}

export function AgentSetupDialog() {
	const t = useTranslations();
	const isMobile = useIsMobile();
	const open = useAgentSetupDialogOpen();

	const title = t("agentSetup.title");
	const description = t("agentSetup.drawerDescription");

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setAgentSetupDialogOpen}>
				<DrawerContent className="flex max-h-[92dvh] min-h-0 flex-col overflow-hidden p-0 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
					<DrawerHeader className="shrink-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
						<AgentSetupBody />
					</div>
					<DrawerFooter className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
						<DrawerClose asChild>
							<Button variant="outline">{t("common.close")}</Button>
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={setAgentSetupDialogOpen}>
			<DialogContent className="flex max-h-[min(88dvh,48rem)] w-[min(100%-1.5rem,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<div className="shrink-0 border-b border-border/60 bg-muted/20 px-5 py-4 pr-14 sm:px-6 sm:py-5">
					<DialogHeader className="pr-0 text-left">
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4 sm:px-6 sm:py-5 [scrollbar-gutter:stable]">
					<AgentSetupBody />
				</div>
			</DialogContent>
		</Dialog>
	);
}
