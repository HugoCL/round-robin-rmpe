import { Link2, MessageSquareText, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { IconActionButton } from "@/components/ui/icon-action-button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ASSIGNMENT_FORM_ID, PR_URL_INPUT_ID } from "@/lib/assignmentFocus";
import type { ParsedPrUrl } from "@/lib/prUrl";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
import type { DuplicateAssignment } from "../hooks/useDuplicatePrCheck";
import type {
	AssignmentCardTag,
	AssignmentMode,
	ResolvedPreview,
} from "./assignmentCard.types";
import { DuplicatePrAlert } from "./DuplicatePrAlert";
import { assignmentChipClass, ExtraRow, UrgentToggle } from "./OptionControls";
import type {
	ReviewerSlotConfig,
	ReviewerSlotPreview,
} from "./ReviewerSlotsConfigurator";
import {
	MAX_BATCH_SLOTS,
	ReviewerSlotsConfigurator,
} from "./ReviewerSlotsConfigurator";

type AssignmentControlsPanelProps = {
	/** Enter in the PR field; the card decides whether assigning is allowed. */
	onSubmit: () => void;
	tags: AssignmentCardTag[];
	mode: AssignmentMode;
	selectedTagId?: Id<"tags">;
	hideMultiAssignmentSection: boolean;
	isMultiAssignmentEnabled: boolean;
	reviewerCount: number;
	onMultiAssignmentToggle: (enabled: boolean) => void;
	urgent: boolean;
	onUrgentChange: (value: boolean) => void;
	availableCrossTeamTargets: Doc<"teams">[];
	reviewers: Reviewer[];
	slotConfigs: ReviewerSlotConfig[];
	reviewerSlotPreviews: ReviewerSlotPreview[];
	onReviewerCountChange: (value: number) => void;
	onSlotChange: (index: number, patch: Partial<ReviewerSlotConfig>) => void;
	prUrl: string;
	onPrUrlChange: (value: string) => void;
	onPrUrlBlur: () => void;
	contextUrl: string;
	onContextUrlChange: (value: string) => void;
	enableCustomMessage: boolean;
	onEnableCustomMessageChange: (value: boolean) => void;
	customMessage: string;
	onCustomMessageChange: (value: string) => void;
	resolvedPreview: ResolvedPreview;
	activeNextReviewer: Reviewer | null;
	duplicateAssignment: DuplicateAssignment | null;
	/** The PR would go back to the person who already has it. */
	duplicateIsReceiver: boolean;
	parsedPrUrl: ParsedPrUrl | null;
	hasPrUrlError: boolean;
	/** Why Assign is unavailable right now; read under the field it concerns. */
	blockedReason?: string | null;
};

export function AssignmentControlsPanel({
	onSubmit,
	tags,
	mode,
	selectedTagId,
	hideMultiAssignmentSection,
	isMultiAssignmentEnabled,
	reviewerCount,
	onMultiAssignmentToggle,
	urgent,
	onUrgentChange,
	availableCrossTeamTargets,
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
	duplicateAssignment,
	duplicateIsReceiver,
	parsedPrUrl,
	hasPrUrlError,
	blockedReason,
}: AssignmentControlsPanelProps) {
	const t = useTranslations();
	const resolvedNamesForMessage = resolvedPreview.resolved
		.map((item) => item.reviewer.name)
		.join(", ");
	const [showContextInput, setShowContextInput] = useState(
		contextUrl.trim().length > 0,
	);
	const [isPrUrlFocused, setIsPrUrlFocused] = useState(false);
	const prUrlInputRef = useRef<HTMLInputElement>(null);

	// Land keyboard focus on the one field the flow starts with, but only where
	// there is a real pointer — on touch this would pop the keyboard on arrival.
	useEffect(() => {
		if (!window.matchMedia("(pointer: fine)").matches) return;
		const active = document.activeElement;
		if (active && active !== document.body) return;
		prUrlInputRef.current?.focus();
	}, []);

	// One person is the plain rotation; two or more is multiple assignment.
	const activeReviewerCount = isMultiAssignmentEnabled ? reviewerCount : 1;
	const setReviewerCount = (count: number) => {
		if (count <= 1) {
			onMultiAssignmentToggle(false);
			return;
		}
		if (!isMultiAssignmentEnabled) onMultiAssignmentToggle(true);
		onReviewerCountChange(count);
	};
	const otherTeams = availableCrossTeamTargets.map((team) => ({
		slug: team.slug,
		name: team.name,
	}));
	// What "+ Add" still offers: lines not on the form yet.
	const addableExtras = [
		...(showContextInput
			? []
			: [
					{
						label: t("pr.chipContext"),
						icon: Link2,
						add: () => setShowContextInput(true),
					},
				]),
		...(enableCustomMessage
			? []
			: [
					{
						label: t("pr.chipMessage"),
						icon: MessageSquareText,
						add: () => onEnableCustomMessageChange(true),
					},
				]),
	];

	return (
		<div className="@container flex flex-col gap-3 lg:gap-4">
			<div className="flex flex-col gap-3 lg:gap-4">
				<form
					id={ASSIGNMENT_FORM_ID}
					data-mode={mode}
					data-duplicate={duplicateAssignment ? "true" : undefined}
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					<Field>
						<FieldLabel htmlFor={PR_URL_INPUT_ID} className="sr-only">
							{t("googleChat.prUrlLabel")}
						</FieldLabel>
						<InputGroup
							className={cn(
								"h-12 rounded-2xl border-control-border bg-background/70",
								hasPrUrlError && "border-destructive",
							)}
						>
							<InputGroupAddon align="inline-start">
								<Link2 className="h-5 w-5" aria-hidden="true" />
							</InputGroupAddon>
							<InputGroupInput
								id={PR_URL_INPUT_ID}
								ref={prUrlInputRef}
								placeholder={t("placeholders.pastePrUrl")}
								value={prUrl}
								onChange={(event) => onPrUrlChange(event.target.value)}
								// With the warning showing, re-assigning takes a deliberate click or Tab.
								onKeyDown={(event) => {
									if (event.key === "Enter" && duplicateAssignment)
										event.preventDefault();
									// Out of the field the single-letter shortcuts work again.
									if (event.key === "Escape" && !prUrl)
										event.currentTarget.blur();
								}}
								onFocus={() => setIsPrUrlFocused(true)}
								onBlur={() => {
									setIsPrUrlFocused(false);
									onPrUrlBlur();
								}}
								aria-keyshortcuts="/"
								required
								aria-required="true"
								aria-invalid={hasPrUrlError || undefined}
								aria-describedby={
									hasPrUrlError
										? "assignment-pr-url-error"
										: parsedPrUrl
											? "assignment-pr-url-parsed"
											: undefined
								}
								autoComplete="off"
								inputMode="url"
								spellCheck={false}
								data-form-autocomplete="off"
							/>
							{prUrl || isPrUrlFocused ? null : (
								<InputGroupAddon align="inline-end" className="hidden sm:flex">
									<Kbd aria-hidden="true">/</Kbd>
								</InputGroupAddon>
							)}
						</InputGroup>
						{hasPrUrlError ? (
							<p
								id="assignment-pr-url-error"
								className="text-xs text-destructive lg:text-sm"
							>
								{t("pr.prUrlInvalid")}
							</p>
						) : parsedPrUrl ? (
							<p
								id="assignment-pr-url-parsed"
								className="font-mono text-xs text-muted-foreground lg:text-sm"
							>
								{t("pr.prUrlRecognized", {
									repo: parsedPrUrl.repo,
									number: parsedPrUrl.number,
								})}
							</p>
						) : null}
						{/* Always mounted, so its first announcement is not lost. */}
						<p
							id="assignment-blocked-reason"
							role="status"
							className="text-xs text-muted-foreground empty:hidden lg:text-sm"
						>
							{hasPrUrlError ? null : blockedReason || null}
						</p>
					</Field>
				</form>

				{duplicateAssignment && (
					<DuplicatePrAlert
						duplicate={duplicateAssignment}
						action={
							duplicateIsReceiver ? (
								<ForceAssignDialog
									draft={{ prUrl, contextUrl, urgent }}
									onAssigned={() => {
										onPrUrlChange("");
										onContextUrlChange("");
										onUrgentChange(false);
									}}
									trigger={
										<Button
											type="button"
											size="sm"
											className="ml-1 cursor-pointer"
										>
											{t("pr.forceAssignAction")}
										</Button>
									}
								/>
							) : null
						}
					/>
				)}

				<div className="flex flex-wrap items-center gap-2">
					<UrgentToggle
						id="assignment-urgent-toggle"
						pressed={urgent}
						onPressedChange={onUrgentChange}
					/>

					{hideMultiAssignmentSection ? null : (
						<div className="flex items-center gap-2">
							<span
								id="assignment-reviewer-count-label"
								className="text-sm text-muted-foreground"
							>
								{t("pr.reviewerCountLabel")}
							</span>
							<div
								role="group"
								aria-labelledby="assignment-reviewer-count-label"
								className="inline-flex items-center rounded-full border border-border/70"
							>
								<IconActionButton
									label={t("pr.decreaseReviewerCount")}
									className="size-9 rounded-full text-muted-foreground"
									disabled={activeReviewerCount <= 1}
									onClick={() => setReviewerCount(activeReviewerCount - 1)}
								>
									<Minus />
								</IconActionButton>
								<span
									className="min-w-6 text-center text-sm font-medium tabular-nums"
									aria-live="polite"
								>
									{activeReviewerCount}
								</span>
								<IconActionButton
									label={t("pr.increaseReviewerCount")}
									className="size-9 rounded-full text-muted-foreground"
									disabled={activeReviewerCount >= MAX_BATCH_SLOTS}
									onClick={() => setReviewerCount(activeReviewerCount + 1)}
								>
									<Plus />
								</IconActionButton>
							</div>
						</div>
					)}

					{addableExtras.length > 0 ? (
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger
								className={cn(
									assignmentChipClass,
									"ml-auto h-9 border border-dashed text-muted-foreground hover:bg-muted/40 hover:text-foreground data-open:bg-muted/40 data-open:text-foreground",
								)}
							>
								<Plus className="size-4 shrink-0" aria-hidden="true" />
								<span className="leading-none">{t("pr.addExtra")}</span>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								{addableExtras.map((extra) => (
									<DropdownMenuItem key={extra.label} onSelect={extra.add}>
										<extra.icon />
										{extra.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>

				{/* Two or more: how each one is picked, under the count that opened it. */}
				<Collapsible
					open={!hideMultiAssignmentSection && isMultiAssignmentEnabled}
					className="contents"
				>
					<CollapsibleContent>
						<div className="sm:pl-32">
							<ReviewerSlotsConfigurator
								mode={mode}
								reviewerCount={reviewerCount}
								minReviewerCount={2}
								embedded
								hideCountControl
								allowReviewerCountChange={false}
								selectedTagId={selectedTagId}
								slots={slotConfigs.slice(0, reviewerCount)}
								reviewers={reviewers}
								tags={tags}
								previews={reviewerSlotPreviews}
								otherTeams={otherTeams}
								onReviewerCountChange={onReviewerCountChange}
								onSlotChange={onSlotChange}
							/>
						</div>
					</CollapsibleContent>
				</Collapsible>

				{/* Added lines stack under the controls that add them, in the order
				    added; the ✕ turns the option off, so a closed row is gone. */}
				<Collapsible open={showContextInput} className="contents">
					<CollapsibleContent>
						<ExtraRow
							label={t("pr.chipContext")}
							icon={Link2}
							onRemove={() => {
								setShowContextInput(false);
								onContextUrlChange("");
							}}
						>
							<FieldLabel htmlFor="assignment-context-url" className="sr-only">
								{t("googleChat.contextUrlLabel")}
							</FieldLabel>
							<InputGroup className="h-10 rounded-2xl border-control-border bg-background/70">
								<InputGroupInput
									id="assignment-context-url"
									placeholder={t("placeholders.contextUrl")}
									value={contextUrl}
									onChange={(event) => onContextUrlChange(event.target.value)}
									autoComplete="off"
									inputMode="url"
									spellCheck={false}
									autoFocus
								/>
							</InputGroup>
						</ExtraRow>
					</CollapsibleContent>
				</Collapsible>

				<Collapsible open={enableCustomMessage} className="contents">
					<CollapsibleContent>
						<ExtraRow
							label={t("pr.chipMessage")}
							icon={MessageSquareText}
							onRemove={() => {
								onEnableCustomMessageChange(false);
								onCustomMessageChange("");
							}}
						>
							<ChatMessageCustomizer
								prUrl={prUrl}
								onPrUrlChange={onPrUrlChange}
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
						</ExtraRow>
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	);
}
