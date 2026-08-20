"use client";

import { useTranslations } from "next-intl";
import { AgentSetupSection } from "@/components/settings/AgentSetupSection";
import { McpTutorialPlayer } from "@/components/settings/McpTutorialPlayer";
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

export function AgentSetupDialog() {
	const t = useTranslations();
	const isMobile = useIsMobile();
	const open = useAgentSetupDialogOpen();

	const title = t("agentSetup.title");
	const description = t("agentSetup.drawerDescription");

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setAgentSetupDialogOpen}>
				<DrawerContent className="max-h-[92vh] overflow-y-auto overscroll-contain">
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<div className="space-y-5 px-4 pb-5">
						<McpTutorialPlayer compact />
						<AgentSetupSection />
					</div>
					<DrawerFooter>
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
			<DialogContent className="max-h-[88vh] overflow-y-auto overscroll-contain sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-5">
					<McpTutorialPlayer />
					<AgentSetupSection />
				</div>
			</DialogContent>
		</Dialog>
	);
}
