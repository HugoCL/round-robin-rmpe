import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextMorph } from "torph/react";
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
	liveSummary: string;
	onAssign: () => Promise<void>;
	onUndoAssignment: () => Promise<void>;
};

export function AssignmentActionsRow({
	isAssigning,
	isAssignDisabled,
	liveSummary,
	onAssign,
	onUndoAssignment,
}: AssignmentActionsRowProps) {
	const t = useTranslations();

	return (
		<div className="space-y-3">
			{liveSummary && (
				<p className="text-sm text-muted-foreground" aria-live="polite">
					{liveSummary}
				</p>
			)}

			<div className="flex items-center gap-3">
				<Button
					onClick={() => void onAssign()}
					disabled={isAssignDisabled}
					className="h-12 flex-1 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					size="lg"
				>
					<TextMorph ease={{ stiffness: 200, damping: 20 }}>
						{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
					</TextMorph>
				</Button>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="h-12 w-12 shrink-0"
								onClick={() => void onUndoAssignment()}
								disabled={isAssigning}
							>
								<Undo2 className="h-5 w-5" aria-hidden="true" />
								<span className="sr-only">{t("pr.undoLastAssignment")}</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>{t("pr.undoLastAssignment")}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
}
