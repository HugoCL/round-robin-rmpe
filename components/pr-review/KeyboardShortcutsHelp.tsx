"use client";

import { Keyboard } from "lucide-react";
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
	const [open, setOpen] = useState(false);

	const shortcuts = [
		{
			key: "Ctrl/Cmd + A",
			description: "Assign PR to next reviewer",
			note: "Only works when a reviewer is available",
		},
		{
			key: "Ctrl/Cmd + S",
			description: "Skip current reviewer",
			note: "Only works when a reviewer is available",
		},
		{
			key: "Ctrl/Cmd + Z",
			description: "Undo last assignment",
			note: "Always available",
		},
		{
			key: "Ctrl/Cmd + R",
			description: "Refresh data",
			note: "Always available",
		},
	];

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-1">
					<Keyboard className="h-4 w-4" />
					<span className="hidden sm:inline">Shortcuts</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogDescription>
						Use these keyboard shortcuts to quickly perform common actions
					</DialogDescription>
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
											<kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-md">
												{key}
											</kbd>
										</span>
									))}
								</div>
							</div>
						))}
					</div>
					<div className="mt-6 p-3 bg-muted rounded-md">
						<p className="text-sm text-muted-foreground">
							<strong>Note:</strong> Keyboard shortcuts work globally when this
							page is active. Some shortcuts are only available when there's a
							next reviewer available.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
