import { Edit2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Reviewer } from "@/lib/types";

type TagAssignmentsCardProps = {
	tags: Doc<"tags">[];
	reviewers: Reviewer[];
	loading: boolean;
	getReviewerTagState: (
		reviewerId: Id<"reviewers">,
		tagId: Id<"tags">,
	) => boolean;
	onToggleReviewerTag: (
		reviewerId: Id<"reviewers">,
		tagId: Id<"tags">,
		currentState: boolean,
	) => void;
	onEditTag: (tag: Doc<"tags">) => void;
	onRemoveTag: (tagId: Id<"tags">) => Promise<void>;
};

export function TagAssignmentsCard({
	tags,
	reviewers,
	loading,
	getReviewerTagState,
	onToggleReviewerTag,
	onEditTag,
	onRemoveTag,
}: TagAssignmentsCardProps) {
	const t = useTranslations();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">{t("tags.existingTags")}</CardTitle>
				<CardDescription>{t("tags.manageExistingDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{tags.length === 0 ? (
					<p className="text-muted-foreground text-center py-4">
						{t("tags.noTagsCreated")}
					</p>
				) : (
					<div className="space-y-4">
						{tags.map((tag) => (
							<div key={tag._id} className="border p-4">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<div
											className="w-4 h-4"
											style={{ backgroundColor: tag.color }}
										/>
										<span className="font-medium">{tag.name}</span>
										{tag.description && (
											<span className="text-sm text-muted-foreground">
												- {tag.description}
											</span>
										)}
									</div>
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onEditTag(tag)}
										>
											<Edit2 className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => void onRemoveTag(tag._id)}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2">
									{reviewers.map((reviewer) => {
										const isAssigned = getReviewerTagState(
											reviewer._id,
											tag._id,
										);
										return (
											<div
												key={reviewer._id}
												className="flex items-center space-x-2"
											>
												<Checkbox
													id={`${tag._id}-${reviewer._id}`}
													checked={isAssigned}
													onCheckedChange={() =>
														onToggleReviewerTag(
															reviewer._id,
															tag._id,
															isAssigned,
														)
													}
													disabled={loading}
												/>
												<Label
													htmlFor={`${tag._id}-${reviewer._id}`}
													className={`text-sm ${reviewer.effectiveIsAbsent ? "opacity-60" : ""}`}
												>
													{reviewer.name}
													{reviewer.effectiveIsAbsent && (
														<span className="text-xs text-muted-foreground ml-1">
															{t("tags.absent")}
														</span>
													)}
												</Label>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
