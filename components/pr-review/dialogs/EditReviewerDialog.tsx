"use client";

import { Edit } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
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
		if (!open) {
			setEdits({}); // Clear edits when closing
			setPartTimeEnabled(Boolean(reviewer.partTimeSchedule));
			setWorkingDays(reviewer.partTimeSchedule?.workingDays ?? []);
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
			<DialogContent className="sm:max-w[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.editReviewer")}</DialogTitle>
					<DialogDescription>{t("reviewer.editDescription")}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={nameId} className="text-right">
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
							className="col-span-3"
							autoFocus
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={chatId} className="text-right">
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
							className="col-span-3"
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={emailId} className="text-right">
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
							className="col-span-3"
						/>
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
