"use client";

import { useMutation, useQuery } from "convex/react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { classifyConvexError } from "@/lib/convexErrors";

/**
 * The way out of a team, at the foot of your own status. It asks once in
 * place, because leaving drops your planned absences along with your turn.
 */
export function LeaveTeamAction({
	teamSlug,
	onLeft,
}: {
	teamSlug: string;
	onLeft: () => void;
}) {
	const t = useTranslations("team.leave");
	const team = useQuery(api.queries.getTeam, { teamSlug });
	const leaveMyTeam = useMutation(api.mutations.leaveMyTeam);
	const [step, setStep] = useState<"idle" | "confirming" | "cancelled">("idle");
	const [isLeaving, setIsLeaving] = useState(false);
	const titleId = useId();
	const descriptionId = useId();

	if (!team) return null;

	// Each step replaces the focused button, so focus moves with it: to the
	// safe choice when asking, back to the action when the person stays.
	if (step !== "confirming") {
		return (
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="-mx-2 self-start text-muted-foreground"
				autoFocus={step === "cancelled"}
				onClick={() => setStep("confirming")}
			>
				<LogOut aria-hidden="true" />
				{t("cta")}
			</Button>
		);
	}

	const handleLeave = async () => {
		setIsLeaving(true);
		try {
			await leaveMyTeam({ teamSlug });
			onLeft();
			toast({ title: t("success", { team: team.name }) });
		} catch (error) {
			toast({
				title:
					classifyConvexError(error) === "lastOwner"
						? t("onlyOwner")
						: t("failed"),
				variant: "destructive",
			});
			setIsLeaving(false);
		}
	};

	return (
		<div
			role="group"
			aria-labelledby={titleId}
			aria-describedby={descriptionId}
			className="flex flex-col gap-2"
		>
			<p id={titleId} className="font-medium">
				{t("title", { team: team.name })}
			</p>
			<p id={descriptionId} className="text-pretty text-muted-foreground">
				{t("description")}
			</p>
			<div className="flex flex-wrap gap-1.5">
				<Button
					type="button"
					variant="destructive"
					size="sm"
					disabled={isLeaving}
					onClick={() => void handleLeave()}
				>
					{isLeaving ? t("leaving") : t("confirm")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					autoFocus
					disabled={isLeaving}
					onClick={() => setStep("cancelled")}
				>
					{t("cancel")}
				</Button>
			</div>
		</div>
	);
}
