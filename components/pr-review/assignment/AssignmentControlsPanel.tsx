import {
	AlertCircle,
	AlertTriangle,
	Globe2,
	MessageSquare,
	UserCheck,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Reviewer } from "@/lib/types";
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
import type {
	AssignmentCardTag,
	AssignmentMode,
	ResolvedPreview,
} from "./assignmentCard.types";
import type {
	ReviewerSlotConfig,
	ReviewerSlotPreview,
} from "./ReviewerSlotsConfigurator";
import { ReviewerSlotsConfigurator } from "./ReviewerSlotsConfigurator";

const selectedPrimaryChipStyle = {
	backgroundColor: "var(--primary)",
	borderColor: "var(--primary)",
	color: "var(--primary-foreground)",
};

const selectedUrgentChipStyle = {
	backgroundColor: "#dc2626",
	borderColor: "#dc2626",
	color: "#ffffff",
};

const selectedCrossTeamChipStyle = {
	backgroundColor: "#0284c7",
	borderColor: "#0284c7",
	color: "#ffffff",
};

type AssignmentControlsPanelProps = {
	tags: AssignmentCardTag[];
	mode: AssignmentMode;
	selectedTagId?: Id<"tags">;
	onModeChange: (mode: AssignmentMode) => void;
	onTagChange: (tagId: Id<"tags">) => void;
	getTagStats: (tagId: Id<"tags">) => {
		totalReviewers: number;
		availableReviewers: number;
	};
	hideMultiAssignmentSection: boolean;
	isMultiAssignmentEnabled: boolean;
	reviewerCount: number;
	onMultiAssignmentToggle: (enabled: boolean) => void;
	effectiveSendMessage: boolean;
	alwaysSendGoogleChatMessage: boolean;
	onSendMessageToggle: (pressed: boolean) => void;
	urgent: boolean;
	onUrgentChange: (value: boolean) => void;
	crossTeamReview: boolean;
	onCrossTeamReviewChange: (value: boolean) => void;
	availableCrossTeamTargets: Doc<"teams">[];
	selectedCrossTeamSlugs: string[];
	onSelectedCrossTeamSlugsChange: (value: string[]) => void;
	excludeTeammates: boolean;
	onExcludeTeammatesChange: (value: boolean) => void;
	showReviewerSlots: boolean;
	reviewers: Reviewer[];
	slotConfigs: ReviewerSlotConfig[];
	reviewerSlotPreviews: ReviewerSlotPreview[];
	onReviewerCountChange: (value: number) => void;
	onSlotChange: (index: number, patch: Partial<ReviewerSlotConfig>) => void;
	prUrl: string;
	onPrUrlChange: (value: string) => void;
	onPrUrlBlur: () => Promise<void> | void;
	contextUrl: string;
	onContextUrlChange: (value: string) => void;
	enableCustomMessage: boolean;
	onEnableCustomMessageChange: (value: boolean) => void;
	customMessage: string;
	onCustomMessageChange: (value: string) => void;
	resolvedPreview: ResolvedPreview;
	activeNextReviewer: Reviewer | null;
	showDuplicateAlert: boolean;
	duplicateAssignment: {
		reviewerName: string;
		timestamp: number;
	} | null;
};

export function AssignmentControlsPanel({
	tags,
	mode,
	selectedTagId,
	onModeChange,
	onTagChange,
	getTagStats,
	hideMultiAssignmentSection,
	isMultiAssignmentEnabled,
	reviewerCount,
	onMultiAssignmentToggle,
	effectiveSendMessage,
	alwaysSendGoogleChatMessage,
	onSendMessageToggle,
	urgent,
	onUrgentChange,
	crossTeamReview,
	onCrossTeamReviewChange,
	availableCrossTeamTargets,
	selectedCrossTeamSlugs,
	onSelectedCrossTeamSlugsChange,
	excludeTeammates,
	onExcludeTeammatesChange,
	showReviewerSlots,
	reviewers,
	slotConfigs,
	reviewerSlotPreviews,
	onReviewerCountChange,
	onSlotChange,
	prUrl,
	onPrUrlChange,
	onPrUrlBlur,
	contextUrl,
	onContextUrlChange,
	enableCustomMessage,
	onEnableCustomMessageChange,
	customMessage,
	onCustomMessageChange,
	resolvedPreview,
	activeNextReviewer,
	showDuplicateAlert,
	duplicateAssignment,
}: AssignmentControlsPanelProps) {
	const t = useTranslations();
	const resolvedNamesForMessage = resolvedPreview.resolved
		.map((item) => item.reviewer.name)
		.join(", ");

	return (
		<div className="flex flex-col gap-4 lg:gap-5">
			{tags.length > 0 && (
				<div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/18 p-4 lg:p-5">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant={mode === "regular" ? "default" : "outline"}
							size="sm"
							onClick={() => onModeChange("regular")}
							className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						>
							{t("pr.assignmentModeRegular")}
						</Button>
						<Button
							variant={mode === "tag" ? "default" : "outline"}
							size="sm"
							onClick={() => onModeChange("tag")}
							className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						>
							{t("pr.assignmentModeWithTags")}
						</Button>
					</div>

					{mode === "tag" && (
						<div className="flex flex-col gap-2">
							<Label htmlFor="assignment-tag-global">
								{t("tags.selectTag")}
							</Label>
							<Select value={selectedTagId} onValueChange={onTagChange}>
								<SelectTrigger
									id="assignment-tag-global"
									className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								>
									<SelectValue placeholder={t("tags.chooseTag")} />
								</SelectTrigger>
								<SelectContent>
									{tags.map((tag) => {
										const stats = getTagStats(tag._id as Id<"tags">);
										return (
											<SelectItem key={tag._id} value={tag._id}>
												{tag.name} ({stats.availableReviewers}/
												{stats.totalReviewers})
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground lg:text-sm">
								{t("tags.tagBasedDescription")}
							</p>
						</div>
					)}
				</div>
			)}

			<div className="flex flex-wrap gap-3 lg:gap-4">
				{!hideMultiAssignmentSection && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<ToggleGroup
									type="multiple"
									variant="outline"
									size="sm"
									spacing={2}
									value={isMultiAssignmentEnabled ? ["multi-assignment"] : []}
									onValueChange={(value) =>
										onMultiAssignmentToggle(value.includes("multi-assignment"))
									}
									className="inline-flex max-w-full"
								>
									<ToggleGroupItem
										value="multi-assignment"
										aria-label={t("pr.multipleAssignmentToggleLabel")}
										className="h-10 max-w-full cursor-pointer rounded-full border-border/70 bg-transparent px-3 text-xs text-foreground transition-all duration-150 lg:h-11 lg:px-4 lg:text-sm"
										style={
											isMultiAssignmentEnabled
												? selectedPrimaryChipStyle
												: undefined
										}
									>
										<div className="inline-flex items-center gap-2.5">
											<span className="inline-flex size-4 items-center justify-center">
												<Users
													className="h-4 w-4 shrink-0"
													aria-hidden="true"
												/>
											</span>
											<span className="leading-none">
												{t("pr.multipleAssignmentToggleLabel")}
											</span>
										</div>
									</ToggleGroupItem>
								</ToggleGroup>
							</TooltipTrigger>
							<TooltipContent className="max-w-64 text-xs">
								<p>{t("pr.multipleAssignmentToggleDescription")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}

				<section className="max-w-full">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div>
									<ForceAssignDialog
										trigger={
											<Button
												variant="outline"
												size="sm"
												className="h-10 max-w-full rounded-full border-border/70 bg-transparent px-3 text-xs text-foreground transition-all duration-150 lg:h-11 lg:px-4 lg:text-sm"
											>
												<div className="inline-flex items-center gap-2.5">
													<span className="inline-flex size-4 items-center justify-center">
														<UserCheck
															className="h-4 w-4 shrink-0"
															aria-hidden="true"
														/>
													</span>
													<span className="leading-none">
														{t("pr.forceAssign")}
													</span>
												</div>
											</Button>
										}
									/>
								</div>
							</TooltipTrigger>
							<TooltipContent className="max-w-64 text-xs">
								<p>{t("reviewer.forceAssignDescription")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</section>

				<section className="max-w-full">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Toggle
									id="assignment-send-message-toggle"
									pressed={effectiveSendMessage}
									onPressedChange={onSendMessageToggle}
									variant="outline"
									size="sm"
									disabled={alwaysSendGoogleChatMessage}
									aria-label={t("googleChat.sendMessageToggle")}
									className="h-10 max-w-full cursor-pointer rounded-full border-border/70 bg-transparent px-3 text-xs text-foreground transition-all duration-150 disabled:cursor-not-allowed lg:h-11 lg:px-4 lg:text-sm"
									style={
										effectiveSendMessage ? selectedPrimaryChipStyle : undefined
									}
								>
									<div className="inline-flex items-center gap-2.5">
										<span className="inline-flex size-4 items-center justify-center">
											<MessageSquare
												className="h-4 w-4 shrink-0"
												aria-hidden="true"
											/>
										</span>
										<span className="leading-none">
											{t("googleChat.sendMessageToggle")}
										</span>
									</div>
								</Toggle>
							</TooltipTrigger>
							<TooltipContent className="max-w-64 text-xs">
								<p>{t("pr.sendMessageToggleDescription")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</section>

				<section className="max-w-full">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Toggle
									id="assignment-urgent-toggle"
									pressed={urgent}
									onPressedChange={onUrgentChange}
									variant="outline"
									size="sm"
									aria-label={t("googleChat.urgentToggle")}
									className="h-10 max-w-full cursor-pointer rounded-full border-red-200/80 bg-transparent px-3 text-xs text-red-700 transition-all duration-150 lg:h-11 lg:px-4 lg:text-sm dark:border-red-900/50 dark:text-red-300"
									style={urgent ? selectedUrgentChipStyle : undefined}
								>
									<div className="inline-flex items-center gap-2.5">
										<span className="inline-flex size-4 items-center justify-center">
											<AlertTriangle
												className="h-4 w-4 shrink-0"
												aria-hidden="true"
											/>
										</span>
										<span className="leading-none">
											{t("googleChat.urgentToggle")}
										</span>
									</div>
								</Toggle>
							</TooltipTrigger>
							<TooltipContent className="max-w-64 text-xs">
								<p>{t("googleChat.urgentToggleDescription")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</section>

				<section className="max-w-full">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Toggle
									id="assignment-cross-team-toggle"
									pressed={crossTeamReview}
									onPressedChange={onCrossTeamReviewChange}
									variant="outline"
									size="sm"
									aria-label={t("googleChat.crossTeamToggle")}
									className="h-10 max-w-full cursor-pointer rounded-full border-sky-200/80 bg-transparent px-3 text-xs text-sky-700 transition-all duration-150 lg:h-11 lg:px-4 lg:text-sm dark:border-sky-900/50 dark:text-sky-300"
									style={
										crossTeamReview ? selectedCrossTeamChipStyle : undefined
									}
								>
									<div className="inline-flex items-center gap-2.5">
										<span className="inline-flex size-4 items-center justify-center">
											<Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
										</span>
										<span className="leading-none">
											{t("googleChat.crossTeamToggle")}
										</span>
									</div>
								</Toggle>
							</TooltipTrigger>
							<TooltipContent className="max-w-64 text-xs">
								<p>{t("googleChat.crossTeamToggleDescription")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</section>
			</div>

			{crossTeamReview && (
				<section className="flex flex-col gap-3 rounded-2xl border border-sky-200/60 bg-sky-50/30 p-4 lg:p-5 dark:border-sky-900/40 dark:bg-sky-950/15">
					<p className="text-xs text-sky-800 lg:text-sm dark:text-sky-200">
						{t("googleChat.crossTeamSharePrompt")}
					</p>
					{availableCrossTeamTargets.length > 0 ? (
						<>
							<Label>{t("googleChat.crossTeamTargetTeamsLabel")}</Label>
							<ToggleGroup
								type="multiple"
								variant="outline"
								size="sm"
								spacing={2}
								value={selectedCrossTeamSlugs}
								onValueChange={onSelectedCrossTeamSlugsChange}
								className="inline-flex max-w-full flex-wrap justify-start"
							>
								{availableCrossTeamTargets.map((teamOption) => (
									<ToggleGroupItem
										key={teamOption._id}
										value={teamOption.slug}
										aria-label={teamOption.name}
										className="h-8 rounded-full border-border/70 bg-transparent px-3 text-xs lg:h-9 lg:text-sm"
									>
										{teamOption.name}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
							{selectedCrossTeamSlugs.length === 0 && (
								<p className="text-xs text-muted-foreground lg:text-sm">
									{t("googleChat.crossTeamTargetTeamsRequired")}
								</p>
							)}
							<div className="flex items-start gap-2 rounded-xl border border-sky-200/70 bg-background/70 p-3 dark:border-sky-900/40">
								<Checkbox
									id="cross-team-exclude-teammates"
									checked={excludeTeammates}
									onCheckedChange={(checked) =>
										onExcludeTeammatesChange(checked === true)
									}
								/>
								<div className="flex flex-col gap-1">
									<Label
										htmlFor="cross-team-exclude-teammates"
										className="cursor-pointer text-xs font-medium text-sky-800 lg:text-sm dark:text-sky-200"
									>
										{t("googleChat.crossTeamExcludeTeammatesToggle")}
									</Label>
									<p className="text-xs text-muted-foreground lg:text-sm">
										{t("googleChat.crossTeamExcludeTeammatesDescription")}
									</p>
								</div>
							</div>
						</>
					) : (
						<p className="text-xs text-muted-foreground lg:text-sm">
							{t("googleChat.crossTeamNoTeamsAvailable")}
						</p>
					)}
				</section>
			)}

			{showReviewerSlots && (
				<section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/18 p-4 lg:p-5">
					<div className="flex flex-wrap gap-2" aria-live="polite">
						<Badge variant="secondary" className="max-w-full">
							{t("pr.multipleAssignmentSummaryEnabled", {
								count: reviewerCount,
							})}
						</Badge>
					</div>
					<ReviewerSlotsConfigurator
						mode={mode}
						reviewerCount={reviewerCount}
						minReviewerCount={2}
						embedded
						selectedTagId={selectedTagId}
						slots={slotConfigs.slice(0, reviewerCount)}
						reviewers={reviewers}
						tags={tags}
						previews={reviewerSlotPreviews}
						allowReviewerCountChange
						onReviewerCountChange={onReviewerCountChange}
						onSlotChange={onSlotChange}
					/>
				</section>
			)}

			{effectiveSendMessage && (
				<section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/18 p-4 lg:p-5">
					{alwaysSendGoogleChatMessage && (
						<p className="text-xs text-muted-foreground lg:text-sm">
							{t("mySettings.messageAlwaysOnHint")}
						</p>
					)}

					<ChatMessageCustomizer
						prUrl={prUrl}
						onPrUrlChange={onPrUrlChange}
						onPrUrlBlur={() => void onPrUrlBlur()}
						contextUrl={contextUrl}
						onContextUrlChange={onContextUrlChange}
						sendMessage={effectiveSendMessage}
						onSendMessageChange={onSendMessageToggle}
						enabled={enableCustomMessage}
						onEnabledChange={onEnableCustomMessageChange}
						message={customMessage}
						onMessageChange={onCustomMessageChange}
						nextReviewerName={
							resolvedNamesForMessage || activeNextReviewer?.name
						}
						showSendToggle={false}
						embedded
					/>
				</section>
			)}

			{showDuplicateAlert && duplicateAssignment && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" aria-hidden="true" />
					<AlertDescription>
						{t("messages.duplicatePRAssigned", {
							reviewer: duplicateAssignment.reviewerName,
							date: new Date(
								duplicateAssignment.timestamp,
							).toLocaleDateString(),
						})}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
