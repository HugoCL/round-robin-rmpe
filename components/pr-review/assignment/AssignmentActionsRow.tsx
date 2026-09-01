import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextMorph } from "torph/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type AssignmentActionsRowProps = {
	isAssigning: boolean;
	isAssignDisabled: boolean;
	/** Why the primary action is unavailable, shown next to the disabled button. */
	blockedReason?: string | null;
	liveSummary: string;
	onAssign: () => Promise<void>;
	onUndoAssignment: () => Promise<void>;
};

export function AssignmentActionsRow({
	isAssigning,
	isAssignDisabled,
	blockedReason,
	liveSummary,
	onAssign,
	onUndoAssignment,
}: AssignmentActionsRowProps) {
	const t = useTranslations();

	return (
		<div className="flex flex-col gap-3">
			{liveSummary && (
				<p className="text-sm text-muted-foreground" aria-live="polite">
					{liveSummary}
				</p>
			)}

			{!liveSummary && blockedReason ? (
				<p
					id="assignment-blocked-reason"
					className="text-sm text-muted-foreground"
					aria-live="polite"
				>
					{blockedReason}
				</p>
			) : null}

			<div className="flex items-center gap-3">
				<Button
					onClick={() => void onAssign()}
					disabled={isAssignDisabled}
					aria-describedby={
						blockedReason ? "assignment-blocked-reason" : undefined
					}
					className="h-12 flex-1 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					size="lg"
				>
					<TextMorph ease={{ stiffness: 200, damping: 20 }}>
						{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
					</TextMorph>
				</Button>

				<TooltipProvider>
					<AlertDialog>
						<Tooltip>
							<TooltipTrigger asChild>
								<AlertDialogTrigger asChild>
									<Button
										variant="outline"
										size="icon-lg"
										className="size-12 shrink-0"
										disabled={isAssigning}
										aria-label={t("pr.undoLastAssignment")}
									>
										<Undo2 aria-hidden="true" />
									</Button>
								</AlertDialogTrigger>
							</TooltipTrigger>
							<TooltipContent>
								<p>{t("pr.undoLastAssignment")}</p>
							</TooltipContent>
						</Tooltip>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{t("history.undoConfirmTitle")}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{t("history.undoLastConfirmDescription")}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={() => void onUndoAssignment()}
								>
									{t("history.undoConfirmAction")}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</TooltipProvider>
			</div>
		</div>
	);
}
