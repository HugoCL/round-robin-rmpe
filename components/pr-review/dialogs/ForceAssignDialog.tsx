"use client";

import { AlertTriangle, UserCheck } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

import { usePRReview } from "../PRReviewContext";

export function ForceAssignDialog() {
	const t = useTranslations();
	const { reviewers, onDataUpdate, userInfo: user } = usePRReview();
	const [forceDialogOpen, setForceDialogOpen] = useState(false);
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

	// Use Convex mutation for force assignment
	const assignPRMutation = useMutation(api.mutations.assignPR);

	const handleForceAssign = async () => {
		if (!selectedReviewerId) {
			toast({
				title: t("common.error"),
				description: t("messages.selectReviewerError"),
				variant: "destructive",
			});
			return;
		}

		try {
			const result = await assignPRMutation({
				reviewerId: selectedReviewerId as Id<"reviewers">,
				forced: true, // Mark as forced assignment
				actionBy: user
					? {
							email: user.email,
							firstName: user.firstName,
							lastName: user.lastName,
						}
					: undefined,
			});

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
		} catch (error) {
			console.error("Error force assigning reviewer:", error);
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
								<SelectItem key={reviewer._id} value={reviewer._id}>
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
						reviewers.find((r) => r._id === selectedReviewerId)?.isAbsent && (
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
