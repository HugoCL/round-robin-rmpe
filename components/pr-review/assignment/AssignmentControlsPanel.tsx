import {
	AlertCircle,
	AlertTriangle,
	Globe2,
	Link2,
	MessageSquare,
	Plus,
	UserCheck,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
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
import { cn } from "@/lib/utils";
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

/** Overrides ToggleGroupItem `data-[state=on]:bg-muted` for the same reason. */
const assignmentGroupItemActivePrimary =
	"data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/95";

const assignmentChipActiveUrgent =
	"aria-pressed:bg-red-600 aria-pressed:border-red-600 aria-pressed:text-white hover:aria-pressed:bg-red-600/90 dark:aria-pressed:bg-red-700 dark:aria-pressed:border-red-700";

const assignmentChipActiveCrossTeam =
	"aria-pressed:bg-sky-600 aria-pressed:border-sky-600 aria-pressed:text-white hover:aria-pressed:bg-sky-600/90 dark:aria-pressed:bg-sky-700 dark:aria-pressed:border-sky-700";

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

const assignmentChipActivePrimary =
	"aria-pressed:bg-primary aria-pressed:border-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/95";

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
	const [showContextInput, setShowContextInput] = useState(
		contextUrl.trim().length > 0,
	);

	return (
		<div className="flex flex-col gap-3 lg:gap-4">
			{tags.length > 0 && (
				<div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/18 p-2 sm:gap-3 sm:p-3 lg:p-4">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant={mode === "regular" ? "default" : "outline"}
							size="sm"
							onClick={() => onModeChange("regular")}
							className="h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						>
							<span className="sm:hidden">
								{t("pr.assignmentModeRegularShort")}
							</span>
							<span className="hidden sm:inline">
								{t("pr.assignmentModeRegular")}
							</span>
						</Button>
						<Button
							variant={mode === "tag" ? "default" : "outline"}
							size="sm"
							onClick={() => onModeChange("tag")}
							className="h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						>
							<span className="sm:hidden">
								{t("pr.assignmentModeWithTagsShort")}
							</span>
							<span className="hidden sm:inline">
								{t("pr.assignmentModeWithTags")}
							</span>
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

			<Field>
				<FieldLabel htmlFor="assignment-pr-url" className="sr-only">
					{t("googleChat.prUrlLabel")}
				</FieldLabel>
				<InputGroup className="h-12 rounded-2xl bg-background/70">
					<InputGroupAddon align="inline-start">
						<Link2 className="h-5 w-5" aria-hidden="true" />
					</InputGroupAddon>
					<InputGroupInput
						id="assignment-pr-url"
						placeholder={t("placeholders.pastePrUrl")}
						value={prUrl}
						onChange={(event) => onPrUrlChange(event.target.value)}
						onBlur={() => void onPrUrlBlur()}
						required
						aria-required="true"
						autoComplete="off"
						inputMode="url"
						spellCheck={false}
						data-form-autocomplete="off"
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							variant={showContextInput ? "secondary" : "ghost"}
							size="sm"
							aria-label={t("googleChat.addContext")}
							aria-pressed={showContextInput}
							onClick={() => {
								setShowContextInput(!showContextInput);
								if (showContextInput) onContextUrlChange("");
							}}
						>
							<Plus data-icon="inline-start" aria-hidden="true" />
							<span className="sm:hidden">
								{t("googleChat.addContextShort")}
							</span>
							<span className="hidden sm:inline">
								{t("googleChat.addContext")}
							</span>
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</Field>

			{showContextInput && (
				<Field>
					<FieldLabel htmlFor="assignment-context-url">
						{t("googleChat.contextUrlLabel")}
					</FieldLabel>
					<InputGroup className="rounded-2xl bg-background/70">
						<InputGroupAddon align="inline-start">
							<Link2 aria-hidden="true" />
						</InputGroupAddon>
						<InputGroupInput
							id="assignment-context-url"
							placeholder={t("placeholders.contextUrl")}
							value={contextUrl}
							onChange={(event) => onContextUrlChange(event.target.value)}
							autoComplete="off"
							inputMode="url"
							spellCheck={false}
						/>
					</InputGroup>
				</Field>
			)}

			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:gap-3 2xl:gap-4">
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
									className="inline-flex w-full max-w-full sm:w-auto"
								>
									<ToggleGroupItem
										value="multi-assignment"
										aria-label={t("pr.multipleAssignmentToggleLabel")}
										className={cn(
											"h-10 w-full max-w-full cursor-pointer rounded-full border-border/70 bg-transparent px-2 text-xs text-foreground transition-colors duration-150 sm:w-auto sm:px-3 lg:h-11 lg:px-4 lg:text-sm",
											isMultiAssignmentEnabled &&
												assignmentGroupItemActivePrimary,
										)}
									>
										<div className="inline-flex items-center gap-2.5">
											<span className="inline-flex size-4 items-center justify-center">
												<Users
													className="h-4 w-4 shrink-0"
													aria-hidden="true"
												/>
											</span>
											<span className="leading-none">
												{t("pr.multipleAssignmentToggleShort")}
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

				<section className="w-full max-w-full sm:w-auto">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="w-full">
									<ForceAssignDialog
										trigger={
											<Button
												variant="outline"
												size="sm"
												className="h-10 w-full max-w-full rounded-full border-border/70 bg-transparent px-2 text-xs text-foreground transition-colors duration-150 sm:w-auto sm:px-3 lg:h-11 lg:px-4 lg:text-sm"
											>
												<div className="inline-flex items-center gap-2.5">
													<span className="inline-flex size-4 items-center justify-center">
														<UserCheck
															className="h-4 w-4 shrink-0"
															aria-hidden="true"
														/>
													</span>
													<span className="leading-none">
														{t("pr.forceAssignShort")}
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

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Toggle
								id="assignment-custom-message-toggle"
								pressed={enableCustomMessage}
								onPressedChange={(pressed) => {
									onEnableCustomMessageChange(pressed);
									if (!pressed) onCustomMessageChange("");
								}}
								variant="outline"
								size="sm"
								aria-label={t("googleChat.customizeToggle")}
								className={cn(
									"col-span-2 h-10 w-full max-w-full cursor-pointer rounded-full border-border/70 bg-transparent px-3 text-xs text-foreground transition-colors duration-150 sm:w-auto lg:h-11 lg:px-4 lg:text-sm",
									enableCustomMessage && assignmentChipActivePrimary,
								)}
							>
								<MessageSquare data-icon="inline-start" />
								{t("googleChat.customizeToggle")}
							</Toggle>
						</TooltipTrigger>
						<TooltipContent className="max-w-64 text-xs">
							<p>{t("googleChat.customizeToggleDescription")}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<section className="w-full max-w-full sm:w-auto">
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
									className={cn(
										"h-10 w-full max-w-full cursor-pointer rounded-full border-red-200/80 bg-transparent px-2 text-xs text-red-700 transition-colors duration-150 sm:w-auto sm:px-3 lg:h-11 lg:px-4 lg:text-sm dark:border-red-900/50 dark:text-red-300",
										urgent && assignmentChipActiveUrgent,
									)}
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

				<section className="w-full max-w-full sm:w-auto">
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
									className={cn(
										"h-10 w-full max-w-full cursor-pointer rounded-full border-sky-200/80 bg-transparent px-2 text-xs text-sky-700 transition-colors duration-150 sm:w-auto sm:px-3 lg:h-11 lg:px-4 lg:text-sm dark:border-sky-900/50 dark:text-sky-300",
										crossTeamReview && assignmentChipActiveCrossTeam,
									)}
								>
									<div className="inline-flex items-center gap-2.5">
										<span className="inline-flex size-4 items-center justify-center">
											<Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
										</span>
										<span className="leading-none">
											{t("googleChat.crossTeamToggleShort")}
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

			{enableCustomMessage && (
				<section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/18 p-4 lg:p-5">
					<ChatMessageCustomizer
						prUrl={prUrl}
						onPrUrlChange={onPrUrlChange}
						onPrUrlBlur={() => void onPrUrlBlur()}
						contextUrl={contextUrl}
						onContextUrlChange={onContextUrlChange}
						enabled={enableCustomMessage}
						onEnabledChange={onEnableCustomMessageChange}
						message={customMessage}
						onMessageChange={onCustomMessageChange}
						nextReviewerName={
							resolvedNamesForMessage || activeNextReviewer?.name
						}
						embedded
						showPrUrlField={false}
						showContextUrlField={false}
						showCustomizeToggle={false}
					/>
				</section>
			)}

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
