"use client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { MyAssignmentsPanel } from "./MyAssignmentsPanel";
import { usePRReview } from "./PRReviewContext";

export function CollapsibleAssignmentsPanel() {
	const { showAssignments, toggleShowAssignments } = usePRReview();
	const t = useTranslations();
	const assignmentsPanelId = useId();
	return (
		<div className=" border bg-card">
			<div className="flex items-center px-2 py-1.5 border-b select-none">
				<button
					type="button"
					className="flex items-center gap-2 flex-1 text-left px-2 py-1  hover:bg-muted/50 focus:outline-none"
					onClick={toggleShowAssignments}
					aria-expanded={showAssignments}
					aria-controls={assignmentsPanelId}
				>
					{showAssignments ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
					<span className="text-sm font-medium">
						{t("pr.assignedToMe")} / {t("pr.iAssigned")}
					</span>
				</button>
			</div>
			{showAssignments && (
				<div id={assignmentsPanelId} className="p-4">
					<MyAssignmentsPanel />
				</div>
			)}
		</div>
	);
}
