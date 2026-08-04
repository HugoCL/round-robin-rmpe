import { PublicSurveyResultsPage } from "@/components/surveys/PublicSurveyResultsPage";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
	params: Promise<{ surveyId: string }>;
};

export default async function PublicSurveyResultsRoute({ params }: Props) {
	const { surveyId } = await params;
	return <PublicSurveyResultsPage surveyId={surveyId as Id<"surveys">} />;
}
