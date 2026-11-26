"use client";

import { useMutation, useQuery } from "convex/react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";

/**
 * Sits where your status would be on a team you are not part of, so joining a
 * second team takes one confirmation instead of asking someone to add you.
 */
export function JoinTeamButton({ teamSlug }: { teamSlug: string }) {
	const t = useTranslations("team.join");
	const access = useQuery(api.queries.getMyTeamAccess, { teamSlug });
	const team = useQuery(api.queries.getTeam, { teamSlug });
	const joinMyselfToTeam = useMutation(api.mutations.joinMyselfToTeam);
	const [isJoining, setIsJoining] = useState(false);
	const titleId = useId();
	const descriptionId = useId();

	if (
		!team ||
		!access?.isAuthenticated ||
		access.memberTeamSlugs.includes(teamSlug)
	) {
		return null;
	}

	const handleJoin = async () => {
		setIsJoining(true);
		try {
			await joinMyselfToTeam({ teamSlug });
			toast({ title: t("success", { team: team.name }) });
		} catch {
			toast({ title: t("failed"), variant: "destructive" });
			setIsJoining(false);
		}
	};

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						size="sm"
						className="h-9 gap-2 rounded-full px-3 text-sm font-medium text-primary hover:bg-primary/8 hover:text-primary aria-expanded:bg-primary/8 aria-expanded:text-primary max-sm:-ml-3 dark:hover:bg-primary/12"
					/>
				}
			>
				<UserPlus className="size-4" aria-hidden="true" />
				{t("cta")}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="gap-3"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
			>
				<p id={titleId} className="font-medium">
					{t("title", { team: team.name })}
				</p>
				<p id={descriptionId} className="text-pretty text-muted-foreground">
					{t("description")}
				</p>
				<Button
					type="button"
					size="sm"
					className="self-start"
					disabled={isJoining}
					onClick={() => void handleJoin()}
				>
					{isJoining ? t("joining") : t("confirm")}
				</Button>
			</PopoverContent>
		</Popover>
	);
}
