import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ASSIGNMENT_FORM_ID } from "@/lib/assignmentFocus";
import { UndoConfirmContent } from "./UndoConfirmContent";
import type { UndoCopy } from "./undoCopy";

type AssignmentActionsRowProps = {
	isAssigning: boolean;
	isAssignDisabled: boolean;
	/** Why the primary action is unavailable; the field above explains it. */
	blockedReason?: string | null;
	/** Names who gets the PR, so the click confirms the hero instead of guessing. */
	assignLabel: string;
	/** Below sm the hero right above already names who gets the PR. */
	assignShortLabel: string;
	/** Shown in the message slot when nothing more urgent is there. */
	chatNotice?: string | null;
	liveSummary: string;
	canUndo: boolean;
	/** False while the duplicate warning makes Enter in the field a no-op. */
	enterAssigns: boolean;
	/** The PR would go back to whoever has it: not the obvious next step. */
	deemphasize?: boolean;
	undoCopy: UndoCopy;
	onUndoAssignment: () => Promise<void>;
};

export function AssignmentActionsRow({
	isAssigning,
	isAssignDisabled,
	blockedReason,
	assignLabel,
	assignShortLabel,
	chatNotice,
	liveSummary,
	canUndo,
	enterAssigns,
	deemphasize = false,
	undoCopy,
	onUndoAssignment,
}: AssignmentActionsRowProps) {
	const t = useTranslations();

	return (
		<div className="flex flex-col">
			{liveSummary ? (
				<p className="mb-3 text-sm text-muted-foreground">{liveSummary}</p>
			) : null}

			{!liveSummary && !blockedReason && chatNotice ? (
				<p className="mb-3 text-sm text-muted-foreground">{chatNotice}</p>
			) : null}

			<div className="flex items-center gap-3">
				<Button
					type="submit"
					form={ASSIGNMENT_FORM_ID}
					variant={deemphasize ? "outline" : "default"}
					aria-label={isAssigning ? undefined : assignLabel}
					disabled={isAssignDisabled}
					aria-describedby={
						blockedReason ? "assignment-blocked-reason" : undefined
					}
					className="h-12 min-w-0 flex-1 shrink overflow-hidden text-base dark:disabled:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					size="lg"
				>
					{isAssigning ? (
						<span className="min-w-0 truncate">{t("tags.assigning")}</span>
					) : (
						<>
							<span className="min-w-0 truncate sm:hidden">
								{assignShortLabel}
							</span>
							<span className="hidden min-w-0 truncate sm:inline">
								{assignLabel}
							</span>
						</>
					)}
					{isAssignDisabled || !enterAssigns ? null : (
						<Kbd
							aria-hidden="true"
							className="hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex"
						>
							↵
						</Kbd>
					)}
				</Button>

				<TooltipProvider>
					<AlertDialog>
						<Tooltip>
							<TooltipTrigger asChild>
								<AlertDialogTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-lg"
										className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
										disabled={isAssigning || !canUndo}
										aria-label={undoCopy.label}
									>
										<Undo2 aria-hidden="true" />
									</Button>
								</AlertDialogTrigger>
							</TooltipTrigger>
							<TooltipContent>
								<p className="flex items-center gap-2">
									{undoCopy.label}
									<Kbd>U</Kbd>
								</p>
							</TooltipContent>
						</Tooltip>
						<UndoConfirmContent
							title={undoCopy.title}
							description={
								<>
									{t("history.undoLastConfirmDescription")}
									{undoCopy.chatNote ? (
										<span className="mt-2 block">{undoCopy.chatNote}</span>
									) : null}
								</>
							}
							onConfirm={() => void onUndoAssignment()}
						/>
					</AlertDialog>
				</TooltipProvider>
			</div>
		</div>
	);
}
