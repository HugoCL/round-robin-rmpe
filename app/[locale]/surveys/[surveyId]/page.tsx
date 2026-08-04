import { SurveyDetailPage } from "@/components/surveys/SurveyDetailPage";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
	params: Promise<{ surveyId: string }>;
};

export default async function SurveyDetailRoute({ params }: Props) {
	const { surveyId } = await params;
	return (
		<SurveyDetailPage key={surveyId} surveyId={surveyId as Id<"surveys">} />
	);
}
