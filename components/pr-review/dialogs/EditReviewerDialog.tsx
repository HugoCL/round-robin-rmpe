"use client";

import { Edit } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartTimeSchedule, Weekday } from "@/lib/reviewerAvailability";
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
	trigger?: React.ReactNode;
}

export function EditReviewerDialog({
	reviewer,
	onUpdateReviewer,
	trigger,
}: EditReviewerDialogProps) {
	const t = useTranslations();
	const [isOpen, setIsOpen] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	// Track edits only when user modifies a field
	const [edits, setEdits] = useState<{
		name?: string;
		email?: string;
		googleChatUserId?: string;
		partTimeSchedule?: PartTimeSchedule;
	}>({});
	const [partTimeEnabled, setPartTimeEnabled] = useState(
		Boolean(reviewer.partTimeSchedule),
	);
	const [excludedOutOfPool, setExcludedOutOfPool] = useState(
		reviewer.excludedFromReviewPool === true,
	);
	const [includedInTagRotations, setIncludedInTagRotations] = useState(
		isIncludedInTagRotations(reviewer),
	);
	const [workingDays, setWorkingDays] = useState<Weekday[]>(
		reviewer.partTimeSchedule?.workingDays ?? [],
	);

	// Derive current values from props + local edits
	const reviewerName = edits.name ?? reviewer.name;
	const reviewerEmail = edits.email ?? reviewer.email;
	const googleChatUserId =
		edits.googleChatUserId ?? reviewer.googleChatUserId ?? "";
	const reviewerPartTimeSchedule =
		edits.partTimeSchedule ?? reviewer.partTimeSchedule;

	// unique ids
	const nameId = useId();
	const emailId = useId();
	const chatId = useId();

	const handleUpdateReviewer = async () => {
		if (
			!reviewerName.trim() ||
			!reviewerEmail.trim() ||
			(partTimeEnabled && workingDays.length === 0)
		) {
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
				excludedOutOfPool,
				includedInTagRotations,
			);
			if (success) {
				setIsOpen(false);
				setEdits({}); // Clear edits on success
			}
		} finally {
			setIsUpdating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleUpdateReviewer();
		}
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			setExcludedOutOfPool(reviewer.excludedFromReviewPool === true);
			setIncludedInTagRotations(isIncludedInTagRotations(reviewer));
			setPartTimeEnabled(Boolean(reviewer.partTimeSchedule));
			setWorkingDays(reviewer.partTimeSchedule?.workingDays ?? []);
		} else {
			setEdits({}); // Clear edits when closing
			setPartTimeEnabled(Boolean(reviewer.partTimeSchedule));
			setWorkingDays(reviewer.partTimeSchedule?.workingDays ?? []);
			setExcludedOutOfPool(reviewer.excludedFromReviewPool === true);
			setIncludedInTagRotations(isIncludedInTagRotations(reviewer));
		}
	};

	const isInvalidPartTimeSelection =
		partTimeEnabled && workingDays.length === 0;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="ghost" size="sm">
						<Edit className="h-4 w-4" />
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.editReviewer")}</DialogTitle>
					<DialogDescription>{t("reviewer.editDescription")}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
						<Label htmlFor={nameId} className="sm:text-right">
							{t("common.name")}
						</Label>
						<Input
							id={nameId}
							placeholder={t("reviewer.enterName")}
							value={reviewerName}
							onChange={(e) =>
								setEdits((prev) => ({ ...prev, name: e.target.value }))
							}
							onKeyDown={handleKeyDown}
							className="sm:col-span-3"
							autoFocus
						/>
					</div>
					<div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
						<Label htmlFor={chatId} className="sm:text-right">
							{t("reviewer.googleChatUserIdLabel", { default: "Chat User ID" })}
						</Label>
						<Input
							id={chatId}
							placeholder={t("reviewer.googleChatUserIdPlaceholder", {
								default: "Optional Google Chat user ID",
							})}
							value={googleChatUserId}
							onChange={(e) =>
								setEdits((prev) => ({
									...prev,
									googleChatUserId: e.target.value,
								}))
							}
							onKeyDown={handleKeyDown}
							className="sm:col-span-3"
						/>
					</div>
					<div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
						<Label htmlFor={emailId} className="sm:text-right">
							{t("common.email")}
						</Label>
						<Input
							id={emailId}
							type="email"
							placeholder={t("reviewer.enterEmail")}
							value={reviewerEmail}
							onChange={(e) =>
								setEdits((prev) => ({ ...prev, email: e.target.value }))
							}
							onKeyDown={handleKeyDown}
							className="sm:col-span-3"
						/>
					</div>
					<div className="calm-subtle-panel col-span-full grid gap-3 p-3">
						<div className="flex items-start gap-3">
							<Checkbox
								id={`${nameId}-out-of-pool`}
								checked={excludedOutOfPool}
								onCheckedChange={(v) => setExcludedOutOfPool(v === true)}
								disabled={isUpdating}
							/>
							<div className="grid gap-1.5 leading-none">
								<label
									htmlFor={`${nameId}-out-of-pool`}
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									{t("reviewer.outOfReviewPoolEditLabel")}
								</label>
								<p className="text-xs text-muted-foreground">
									{t("reviewer.outOfReviewPoolEditHint")}
								</p>
							</div>
						</div>
						<div className="flex items-start gap-3 border-t border-border/60 pt-3">
							<Checkbox
								id={`${nameId}-tag-rotations`}
								checked={includedInTagRotations}
								onCheckedChange={(v) => setIncludedInTagRotations(v === true)}
								disabled={isUpdating}
							/>
							<div className="grid gap-1.5 leading-none">
								<label
									htmlFor={`${nameId}-tag-rotations`}
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									{t("reviewer.tagRotationsEditLabel")}
								</label>
								<p className="text-xs text-muted-foreground">
									{t("reviewer.tagRotationsEditHint")}
								</p>
							</div>
						</div>
					</div>
					<div className="col-span-full">
						<PartTimeScheduleFields
							enabled={partTimeEnabled}
							workingDays={workingDays}
							onEnabledChange={(enabled) => {
								setPartTimeEnabled(enabled);
								setEdits((prev) => ({
									...prev,
									partTimeSchedule: enabled
										? reviewerPartTimeSchedule
										: undefined,
								}));
							}}
							onWorkingDaysChange={(nextWorkingDays) => {
								setWorkingDays(nextWorkingDays);
								setEdits((prev) => ({
									...prev,
									partTimeSchedule: scheduleFromSelection(
										partTimeEnabled,
										nextWorkingDays,
									),
								}));
							}}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setIsOpen(false)}
						disabled={isUpdating}
					>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleUpdateReviewer}
						disabled={
							!reviewerName.trim() ||
							!reviewerEmail.trim() ||
							isUpdating ||
							isInvalidPartTimeSelection
						}
					>
						{isUpdating ? t("common.updating") : t("common.update")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
