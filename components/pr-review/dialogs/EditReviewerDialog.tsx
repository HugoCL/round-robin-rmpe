"use client";

import { Edit } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentType, type ReactNode, useId, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@/components/ui/field";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	normalizeWorkingDays,
	type PartTimeSchedule,
	type Weekday,
	WORKDAY_VALUES,
} from "@/lib/reviewerAvailability";
import { isIncludedInTagRotations } from "@/lib/reviewerEligibility";
import type { Reviewer } from "@/lib/types";
import {
	PartTimeScheduleFields,
	scheduleFromSelection,
} from "./PartTimeScheduleFields";

interface EditReviewerDialogProps {
	reviewer: Reviewer;
	onUpdateReviewer: (
		id: Reviewer["_id"],
		name: string,
		email: string,
		googleChatUserId?: string,
		partTimeSchedule?: PartTimeSchedule,
		excludedFromReviewPool?: boolean,
		includedInTagRotations?: boolean,
	) => Promise<boolean>;
	trigger?: ReactNode;
}

function getInitials(name?: string) {
	return (
		name
			?.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join("")
			.toUpperCase() || "?"
	);
}

function schedulesMatch(
	enabled: boolean,
	workingDays: Weekday[],
	original?: PartTimeSchedule,
): boolean {
	const next = scheduleFromSelection(enabled, workingDays);
	const originalDays = normalizeWorkingDays(original?.workingDays);
	const nextDays = next?.workingDays ?? [];
	if (originalDays.length !== nextDays.length) {
		return false;
	}
	return originalDays.every((day, index) => day === nextDays[index]);
}

export function EditReviewerDialog({
	reviewer,
	onUpdateReviewer,
	trigger,
}: EditReviewerDialogProps) {
	const t = useTranslations();
	const isMobile = useIsMobile();
	const [isOpen, setIsOpen] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [reviewerName, setReviewerName] = useState(reviewer.name);
	const [reviewerEmail, setReviewerEmail] = useState(reviewer.email);
	const [googleChatUserId, setGoogleChatUserId] = useState(
		reviewer.googleChatUserId ?? "",
	);
	const [partTimeEnabled, setPartTimeEnabled] = useState(
		Boolean(reviewer.partTimeSchedule),
	);
	const [includedInRotation, setIncludedInRotation] = useState(
		reviewer.excludedFromReviewPool !== true,
	);
	const [includedInTagRotations, setIncludedInTagRotations] = useState(
		isIncludedInTagRotations(reviewer),
	);
	const [workingDays, setWorkingDays] = useState<Weekday[]>(
		normalizeWorkingDays(reviewer.partTimeSchedule?.workingDays),
	);

	const nameId = useId();
	const emailId = useId();
	const chatId = useId();
	const rotationId = useId();
	const tagRotationsId = useId();

	const resetFromReviewer = () => {
		setReviewerName(reviewer.name);
		setReviewerEmail(reviewer.email);
		setGoogleChatUserId(reviewer.googleChatUserId ?? "");
		setIncludedInRotation(reviewer.excludedFromReviewPool !== true);
		setIncludedInTagRotations(isIncludedInTagRotations(reviewer));
		setPartTimeEnabled(Boolean(reviewer.partTimeSchedule));
		setWorkingDays(
			normalizeWorkingDays(reviewer.partTimeSchedule?.workingDays),
		);
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		resetFromReviewer();
	};

	const isInvalidPartTimeSelection =
		partTimeEnabled && workingDays.length === 0;
	const canSubmit =
		Boolean(reviewerName.trim()) &&
		Boolean(reviewerEmail.trim()) &&
		!isInvalidPartTimeSelection;
	const hasChanges =
		reviewerName.trim() !== reviewer.name.trim() ||
		reviewerEmail.trim() !== reviewer.email.trim() ||
		(googleChatUserId.trim() || "") !==
			(reviewer.googleChatUserId?.trim() || "") ||
		includedInRotation !== (reviewer.excludedFromReviewPool !== true) ||
		includedInTagRotations !== isIncludedInTagRotations(reviewer) ||
		!schedulesMatch(partTimeEnabled, workingDays, reviewer.partTimeSchedule);

	const handleUpdateReviewer = async () => {
		if (!canSubmit || isUpdating || !hasChanges) {
			return;
		}

		setIsUpdating(true);
		try {
			const success = await onUpdateReviewer(
				reviewer._id,
				reviewerName.trim(),
				reviewerEmail.trim(),
				googleChatUserId.trim() || undefined,
				scheduleFromSelection(partTimeEnabled, workingDays),
				!includedInRotation,
				includedInTagRotations,
			);
			if (success) {
				setIsOpen(false);
			}
		} finally {
			setIsUpdating(false);
		}
	};

	const displayName = reviewerName.trim() || reviewer.name;
	const statusParts = [
		includedInRotation ? null : t("reviewer.outOfReviewPoolBadge"),
		partTimeEnabled ? t("partTime.shortLabel") : null,
	].filter((part): part is string => Boolean(part));
	const statusLine = statusParts.join(" · ");

	const header = (
		Title: ComponentType<{ className?: string; children?: ReactNode }>,
		Description: ComponentType<{
			className?: string;
			asChild?: boolean;
			children?: ReactNode;
		}>,
	) => (
		<div className="flex items-start gap-3">
			<Avatar size="lg" className="mt-0.5">
				<AvatarFallback>{getInitials(displayName)}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<p className="calm-kicker mb-1">{t("reviewer.editKicker")}</p>
				<Title className="truncate">{displayName}</Title>
				<Description asChild>
					<div className="mt-0.5">
						<p className="truncate">{reviewer.email}</p>
						{statusLine ? <p className="mt-0.5 text-xs">{statusLine}</p> : null}
					</div>
				</Description>
			</div>
		</div>
	);

	const fields = (
		<FieldGroup className="gap-4">
			<FieldSet className="gap-3">
				<Field>
					<FieldLabel htmlFor={nameId}>{t("common.name")}</FieldLabel>
					<Input
						id={nameId}
						name="name"
						autoComplete="name"
						placeholder={t("reviewer.enterName")}
						value={reviewerName}
						onChange={(event) => setReviewerName(event.target.value)}
						disabled={isUpdating}
						autoFocus={!isMobile}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={emailId}>{t("common.email")}</FieldLabel>
					<Input
						id={emailId}
						name="email"
						type="email"
						autoComplete="email"
						placeholder={t("reviewer.enterEmail")}
						value={reviewerEmail}
						onChange={(event) => setReviewerEmail(event.target.value)}
						disabled={isUpdating}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={chatId}>
						{t("reviewer.googleChatUserIdLabel")}
					</FieldLabel>
					<Input
						id={chatId}
						name="googleChatUserId"
						autoComplete="off"
						spellCheck={false}
						placeholder={t("reviewer.googleChatUserIdPlaceholder")}
						value={googleChatUserId}
						onChange={(event) => setGoogleChatUserId(event.target.value)}
						disabled={isUpdating}
					/>
					<FieldDescription>
						{t("reviewer.googleChatUserIdHelp")}
					</FieldDescription>
				</Field>
			</FieldSet>

			<Separator />

			<FieldSet className="gap-3">
				<p className="calm-kicker">{t("reviewer.rotationSection")}</p>
				<Field orientation="horizontal" data-disabled={isUpdating || undefined}>
					<FieldContent>
						<FieldLabel htmlFor={rotationId}>
							{t("reviewer.inReviewPoolSwitchLabel")}
						</FieldLabel>
						<FieldDescription>
							{t("reviewer.automaticAssignmentHelp")}
						</FieldDescription>
					</FieldContent>
					<Switch
						id={rotationId}
						className="shrink-0"
						checked={includedInRotation}
						onCheckedChange={setIncludedInRotation}
						disabled={isUpdating}
					/>
				</Field>
				<Field orientation="horizontal" data-disabled={isUpdating || undefined}>
					<FieldContent>
						<FieldLabel htmlFor={tagRotationsId}>
							{t("reviewer.tagRotationsEditLabel")}
						</FieldLabel>
						<FieldDescription>
							{t("reviewer.tagRotationsEditHint")}
						</FieldDescription>
					</FieldContent>
					<Switch
						id={tagRotationsId}
						className="shrink-0"
						checked={includedInTagRotations}
						onCheckedChange={setIncludedInTagRotations}
						disabled={isUpdating}
					/>
				</Field>
				<PartTimeScheduleFields
					enabled={partTimeEnabled}
					workingDays={workingDays}
					disabled={isUpdating}
					onEnabledChange={(enabled) => {
						setPartTimeEnabled(enabled);
						if (enabled && workingDays.length === 0) {
							setWorkingDays([...WORKDAY_VALUES]);
						}
					}}
					onWorkingDaysChange={setWorkingDays}
				/>
			</FieldSet>
		</FieldGroup>
	);

	const footer = (
		<>
			<Button
				type="button"
				variant="outline"
				onClick={() => handleOpenChange(false)}
				disabled={isUpdating}
			>
				{t("common.cancel")}
			</Button>
			<Button type="submit" disabled={!canSubmit || !hasChanges || isUpdating}>
				{isUpdating ? <Spinner data-icon="inline-start" /> : null}
				{isUpdating ? t("common.saving") : t("common.save")}
			</Button>
		</>
	);

	const triggerNode = (
		<span className="inline-flex" onClick={() => handleOpenChange(true)}>
			{trigger || (
				<IconActionButton label={t("reviewer.editReviewer")}>
					<Edit />
				</IconActionButton>
			)}
		</span>
	);

	if (isMobile) {
		return (
			<>
				{triggerNode}
				<Drawer open={isOpen} onOpenChange={handleOpenChange}>
					<DrawerContent className="flex max-h-[92dvh] min-h-0 flex-col overflow-hidden p-0 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
						<DrawerHeader className="shrink-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
							{header(DrawerTitle, DrawerDescription)}
						</DrawerHeader>
						<form
							className="flex min-h-0 flex-1 flex-col"
							onSubmit={(event) => {
								event.preventDefault();
								void handleUpdateReviewer();
							}}
						>
							<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
								{fields}
							</div>
							<DrawerFooter className="shrink-0 flex-col-reverse pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
								{footer}
							</DrawerFooter>
						</form>
					</DrawerContent>
				</Drawer>
			</>
		);
	}

	return (
		<>
			{triggerNode}
			<Dialog open={isOpen} onOpenChange={handleOpenChange}>
				<DialogContent className="flex max-h-[88dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
					<div className="shrink-0 border-b border-border/60 px-6 py-4 pr-14">
						<DialogHeader className="pr-0">
							{header(DialogTitle, DialogDescription)}
						</DialogHeader>
					</div>
					<form
						className="flex min-h-0 flex-1 flex-col"
						onSubmit={(event) => {
							event.preventDefault();
							void handleUpdateReviewer();
						}}
					>
						<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4">
							{fields}
						</div>
						<DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
							{footer}
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
