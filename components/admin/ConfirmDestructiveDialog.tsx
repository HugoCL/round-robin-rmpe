"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Type-to-confirm gate for irreversible operations.
 *
 * A plain "are you sure" is reflexively dismissed; retyping the name of the
 * thing forces the person to read what they are about to run.
 */
export function ConfirmDestructiveDialog({
	open,
	title,
	description,
	confirmWord,
	confirmLabel,
	onOpenChange,
	onConfirm,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmWord: string;
	confirmLabel: string;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	const tCommon = useTranslations();
	const inputId = useId();
	const [typed, setTyped] = useState("");

	useEffect(() => {
		if (open) setTyped("");
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-1.5">
					<label htmlFor={inputId} className="text-sm text-muted-foreground">
						<code className="font-mono">{confirmWord}</code>
					</label>
					<Input
						id={inputId}
						value={typed}
						autoComplete="off"
						className="font-mono"
						onChange={(event) => setTyped(event.target.value)}
					/>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						{tCommon("common.cancel")}
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={typed.trim() !== confirmWord}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
