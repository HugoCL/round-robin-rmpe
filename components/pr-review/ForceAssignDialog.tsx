"use client";

import { AlertTriangle, UserCheck } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { forceAssignReviewer, type Reviewer } from "@/app/[locale]/actions";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface ForceAssignDialogProps {
	reviewers: Reviewer[];
	onDataUpdate: () => Promise<void>;
	user?: { email: string; firstName?: string; lastName?: string } | null;
}

export function ForceAssignDialog({
	reviewers,
	onDataUpdate,
	user,
}: ForceAssignDialogProps) {
	const t = useTranslations();
	const [forceDialogOpen, setForceDialogOpen] = useState(false);
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

	const handleForceAssign = async () => {
		if (!selectedReviewerId) {
			toast({
				title: t("common.error"),
				description: t("messages.selectReviewerError"),
				variant: "destructive",
			});
			return;
		}

		const result = await forceAssignReviewer(
			selectedReviewerId,
			user || undefined,
		);

		if (result.success && result.reviewer) {
			// Refresh data to get updated reviewers and feed
			await onDataUpdate();

			// Show appropriate toast based on reviewer status
			if (result.reviewer.isAbsent) {
				toast({
					title: t("pr.forceAssign"),
					description: t("messages.forceAssignAbsentWarning", {
						reviewer: result.reviewer.name,
					}),
				});
			} else {
				toast({
					title: t("pr.forceAssign"),
					description: t("messages.forceAssignSuccess", {
						reviewer: result.reviewer.name,
					}),
				});
			}

			// Close the dialog
			setForceDialogOpen(false);
			setSelectedReviewerId("");
		} else {
			toast({
				title: t("common.error"),
				description: t("messages.forceAssignFailed"),
				variant: "destructive",
			});
		}
	};

	return (
		<Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" className="w-full">
					<UserCheck className="h-4 w-4 mr-2" />
					{t("pr.forceAssign")} PR
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.forceAssignTitle")}</DialogTitle>
					<DialogDescription>
						{t("reviewer.forceAssignDescription")}
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<Select
						value={selectedReviewerId}
						onValueChange={setSelectedReviewerId}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("reviewer.selectReviewer")} />
						</SelectTrigger>
						<SelectContent>
							{reviewers.map((reviewer) => (
								<SelectItem key={reviewer.id} value={reviewer.id}>
									<div className="flex items-center">
										<span>{reviewer.name}</span>
										{reviewer.isAbsent && (
											<AlertTriangle className="h-4 w-4 ml-2 text-amber-500" />
										)}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{selectedReviewerId &&
						reviewers.find((r) => r.id === selectedReviewerId)?.isAbsent && (
							<div className="mt-2 text-sm text-amber-500 flex items-center">
								<AlertTriangle className="h-4 w-4 mr-1" />
								<span>{t("tags.absent")}</span>
							</div>
						)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setForceDialogOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleForceAssign}>{t("pr.forceAssign")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
