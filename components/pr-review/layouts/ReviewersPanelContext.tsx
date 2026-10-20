import { useTranslations } from "next-intl";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { usePRReview } from "../PRReviewContext";

/**
 * The layout owns the reviewers sheet; the assignment cards open it from
 * "see all" next to the rotation they summarize.
 */
export const ReviewersPanelContext = createContext<{
	openPanel: (opener: HTMLElement) => void;
} | null>(null);

export const useReviewersPanel = () => useContext(ReviewersPanelContext);

export function ViewReviewersLink() {
	const t = useTranslations("pr");
	const { reviewers } = usePRReview();
	const reviewersPanel = useReviewersPanel();
	if (!reviewersPanel) return null;

	return (
		<Button
			type="button"
			variant="link"
			onClick={(event) => reviewersPanel.openPanel(event.currentTarget)}
			className="h-auto p-0 text-sm text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground lg:text-base"
		>
			{t("viewReviewers", { count: reviewers.length })}
		</Button>
	);
}
