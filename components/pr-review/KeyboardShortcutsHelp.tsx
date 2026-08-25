"use client";

import { Keyboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { WithTooltip } from "@/components/ui/tooltip";

export function KeyboardShortcutsHelp({
	iconOnly = false,
}: {
	iconOnly?: boolean;
}) {
	const t = useTranslations();
	const [open, setOpen] = useState(false);

	const shortcuts = [
		{
			key: "Ctrl/Cmd + A",
			description: t("shortcuts.assignPR"),
			note: t("shortcuts.onlyAvailable"),
		},
		{
			key: "Ctrl/Cmd + S",
			description: t("shortcuts.skipReviewer"),
			note: t("shortcuts.onlyAvailable"),
		},
		{
			key: "Ctrl/Cmd + Z",
			description: t("shortcuts.undoAssignment"),
			note: t("shortcuts.alwaysAvailable"),
		},
	];

	return (
		<>
			{iconOnly ? (
				<IconActionButton
					label={t("shortcuts.help")}
					onClick={() => setOpen(true)}
				>
					<Keyboard />
				</IconActionButton>
			) : null}
			<Dialog open={open} onOpenChange={setOpen}>
				{iconOnly ? null : (
					<DialogTrigger asChild>
						<span className="inline-flex">
							<WithTooltip label={t("shortcuts.help")}>
								<Button
									variant="outline"
									size="sm"
									className="flex items-center gap-1"
									aria-label={t("shortcuts.help")}
								>
									<Keyboard className="h-4 w-4" />
									<span className="hidden sm:inline">
										{t("shortcuts.help")}
									</span>
								</Button>
							</WithTooltip>
						</span>
					</DialogTrigger>
				)}
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>{t("shortcuts.title")}</DialogTitle>
						<DialogDescription>{t("shortcuts.description")}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="calm-list">
							{shortcuts.map((shortcut) => (
								<div
									key={shortcut.key}
									className="flex items-start justify-between gap-4 p-3"
								>
									<div className="flex-1">
										<div className="font-medium">{shortcut.description}</div>
										<div className="text-sm text-muted-foreground">
											{shortcut.note}
										</div>
									</div>
									<KbdGroup>
										{shortcut.key.split(" + ").map((key) => (
											<span key={key} className="flex items-center gap-1">
												{key !== shortcut.key.split(" + ")[0] && (
													<span className="text-muted-foreground">+</span>
												)}
												<Kbd>{key}</Kbd>
											</span>
										))}
									</KbdGroup>
								</div>
							))}
						</div>
						<div className="calm-subtle-panel p-3">
							<p className="text-sm text-muted-foreground">
								<strong>{t("shortcuts.note")}</strong>{" "}
								{t("shortcuts.globalNote")}
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
