import { SuggestionDetail } from "@/components/suggestions/SuggestionDetail";

type Props = {
	params: Promise<{ suggestionId: string }>;
};

export default async function SuggestionDetailPage({ params }: Props) {
	const { suggestionId } = await params;
	return <SuggestionDetail suggestionId={suggestionId} />;
}
