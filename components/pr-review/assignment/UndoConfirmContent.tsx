import { useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";
import {
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { focusPrUrlInput } from "@/lib/assignmentFocus";

/**
 * The one undo confirm, from the card, the U shortcut and history rows: the
 * title names the PR and the person, so nobody undoes the wrong assignment.
 */
export function UndoConfirmContent({
	title,
	description,
	onConfirm,
	pending = false,
	focusConfirm = false,
}: {
	title: string;
	description: ReactNode;
	onConfirm: () => void;
	pending?: boolean;
	/**
	 * From a keyboard shortcut: Enter confirms what the key started, and on
	 * close focus goes back to the PR field instead of falling to the page.
	 */
	focusConfirm?: boolean;
}) {
	const t = useTranslations();
	const confirmRef = useRef<HTMLButtonElement>(null);

	return (
		<AlertDialogContent
			onOpenAutoFocus={
				focusConfirm
					? (event) => {
							event.preventDefault();
							confirmRef.current?.focus();
						}
					: undefined
			}
			onCloseAutoFocus={
				focusConfirm
					? (event) => {
							event.preventDefault();
							focusPrUrlInput();
						}
					: undefined
			}
		>
			<AlertDialogHeader>
				<AlertDialogTitle>{title}</AlertDialogTitle>
				<AlertDialogDescription>{description}</AlertDialogDescription>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
				<AlertDialogAction
					ref={confirmRef}
					variant="destructive"
					disabled={pending}
					onClick={onConfirm}
				>
					{pending ? t("history.undoing") : t("history.undoConfirmAction")}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	);
}
