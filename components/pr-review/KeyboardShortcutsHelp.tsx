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

export function KeyboardShortcutsHelp() {
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
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-1">
					<Keyboard className="h-4 w-4" />
					<span className="hidden sm:inline">{t("shortcuts.help")}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{t("shortcuts.title")}</DialogTitle>
					<DialogDescription>{t("shortcuts.description")}</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<div className="space-y-4">
						{shortcuts.map((shortcut) => (
							<div
								key={shortcut.key}
								className="flex items-start justify-between gap-4"
							>
								<div className="flex-1">
									<div className="font-medium">{shortcut.description}</div>
									<div className="text-sm text-muted-foreground">
										{shortcut.note}
									</div>
								</div>
								<div className="flex items-center gap-1">
									{shortcut.key.split(" + ").map((key) => (
										<span key={key} className="flex items-center">
											{key !== shortcut.key.split(" + ")[0] && (
												<span className="mx-1">+</span>
											)}
											<kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 ">
												{key}
											</kbd>
										</span>
									))}
								</div>
							</div>
						))}
					</div>
					<div className="mt-6 p-3 bg-muted ">
						<p className="text-sm text-muted-foreground">
							<strong>{t("shortcuts.note")}</strong> {t("shortcuts.globalNote")}
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
