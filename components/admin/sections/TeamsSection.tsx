"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import { useAdminErrorToast } from "@/hooks/useAdminErrorToast";

type BackfillReport = {
	dryRun: boolean;
	teamsWithoutOwner: number;
	teamsChanged: number;
	report: Array<{
		teamSlug: string;
		owner: string | null;
		tiedCount: number;
		filteredSeedRows: boolean;
		alreadyHadOwner: boolean;
		rosterSize: number;
	}>;
};

export function TeamsSection() {
	const t = useTranslations("admin");
	const _tCommon = useTranslations();
	const { toast } = useToast();
	const showError = useAdminErrorToast();

	const teams = useQuery(api.adminDirectory.listTeamsWithRoster, {});
	const orphans = useQuery(api.teamRoles.listTeamsWithoutOwner, {});
	const backfill = useMutation(api.teamRoles.backfillTeamOwners);
	const setReviewerRole = useMutation(api.teamRoles.setReviewerRole);

	const [preview, setPreview] = useState<BackfillReport | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	// Controlled so "Assign an owner" can open the roster it refers to.
	const [openTeams, setOpenTeams] = useState<ReadonlySet<string>>(new Set());

	const setTeamOpen = (teamId: string, open: boolean) => {
		setOpenTeams((current) => {
			const next = new Set(current);
			if (open) next.add(teamId);
			else next.delete(teamId);
			return next;
		});
	};

	const runBackfill = async (dryRun: boolean) => {
		setIsRunning(true);
		try {
			const result = (await backfill({ dryRun })) as BackfillReport;
			setPreview(result);
			toast({
				title: dryRun
					? t("teams.backfillPreviewed")
					: t("teams.backfillApplied"),
				description: t("teams.backfillSummary", {
					changed: result.teamsChanged,
					orphaned: result.teamsWithoutOwner,
				}),
			});
		} catch (error) {
			showError(error);
		} finally {
			setIsRunning(false);
		}
	};

	const changeRole = async (
		reviewerId: Id<"reviewers">,
		role: "owner" | "member",
	) => {
		setPendingId(reviewerId);
		try {
			await setReviewerRole({ reviewerId, role });
			toast({ title: t("teams.roleUpdated") });
		} catch (error) {
			showError(error);
		} finally {
			setPendingId(null);
		}
	};

	if (teams === undefined || orphans === undefined) {
		return (
			<AdminSectionShell
				title={t("teams.title")}
				description={t("teams.description")}
			>
				<Skeleton className="h-48 w-full" />
			</AdminSectionShell>
		);
	}

	return (
		<AdminSectionShell
			title={t("teams.title")}
			description={t("teams.description")}
			action={
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isRunning}
						onClick={() => void runBackfill(true)}
					>
						{t("teams.previewBackfill")}
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={isRunning || preview === null}
						onClick={() => void runBackfill(false)}
					>
						{t("teams.applyBackfill")}
					</Button>
				</div>
			}
		>
			<div className="space-y-4">
				{/* Teams nobody can administer. Should read zero after the backfill. */}
				{orphans.length > 0 ? (
					<Alert>
						<AlertTriangle aria-hidden="true" />
						<AlertTitle>{t("teams.orphanedTitle")}</AlertTitle>
						<AlertDescription>
							{t("teams.orphanedDescription", { count: orphans.length })}
						</AlertDescription>
					</Alert>
				) : null}

				{/* Reviewing the pick before applying it is the whole safety story
				    for a backfill that runs once against live data. */}
				{preview ? (
					<div className="calm-subtle-panel space-y-2 p-4">
						<p className="text-sm font-medium">
							{preview.dryRun
								? t("teams.previewHeading")
								: t("teams.appliedHeading")}
						</p>
						<ul className="space-y-1 text-xs">
							{preview.report
								.filter((entry) => !entry.alreadyHadOwner)
								.map((entry) => (
									<li key={entry.teamSlug} className="flex flex-wrap gap-2">
										<code className="font-mono">{entry.teamSlug}</code>
										<span className="text-muted-foreground">
											{entry.owner ?? t("teams.noCandidate")}
										</span>
										{entry.tiedCount > 1 ? (
											<Badge variant="secondary">
												{t("teams.tied", { count: entry.tiedCount })}
											</Badge>
										) : null}
										{entry.filteredSeedRows ? (
											<Badge variant="secondary">
												{t("teams.seedFiltered")}
											</Badge>
										) : null}
									</li>
								))}
						</ul>
					</div>
				) : null}

				<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
					{teams.map((team) => (
						<li key={team._id}>
							<Collapsible
								open={openTeams.has(team._id)}
								onOpenChange={(open) => setTeamOpen(team._id, open)}
							>
								<div className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3">
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{team.name}</p>
										<p className="truncate font-mono text-xs text-muted-foreground">
											{team.slug}
										</p>
									</div>
									{team.owners.length === 0 ? (
										<>
											<Badge variant="secondary">{t("teams.noOwner")}</Badge>
											{/* The backfill handles these in bulk. This is the way
											    out when its pick is wrong, or for one team. */}
											{team.memberCount > 0 ? (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => setTeamOpen(team._id, true)}
												>
													<ShieldCheck aria-hidden="true" />
													{t("teams.assignOwner")}
												</Button>
											) : null}
										</>
									) : (
										<Badge
											variant="secondary"
											className="max-w-full gap-1 font-mono"
											title={team.owners.map((owner) => owner.name).join(", ")}
										>
											<ShieldCheck
												className="size-3 shrink-0"
												aria-hidden="true"
											/>
											{/* Email, not display name: authorization keys on the
											    address, and stored names can be stale leftovers. */}
											<span className="truncate">
												{team.owners.map((owner) => owner.email).join(", ")}
											</span>
										</Badge>
									)}
									<CollapsibleTrigger asChild>
										<Button type="button" variant="ghost" size="sm">
											<Users aria-hidden="true" />
											{t("teams.members", { count: team.memberCount })}
										</Button>
									</CollapsibleTrigger>
								</div>
								<CollapsibleContent>
									<ul className="divide-y divide-border/40 border-t border-border/40 bg-muted/20">
										{team.members.map((member) => {
											const isOwner = member.role === "owner";
											// The server refuses this too. Disabling it here just
											// avoids offering a button that cannot work.
											const isLastOwner = isOwner && team.owners.length === 1;
											return (
												<li
													key={member._id}
													className="flex min-h-12 flex-wrap items-center gap-2 px-6 py-2"
												>
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm">{member.name}</p>
														<p className="truncate font-mono text-xs text-muted-foreground">
															{member.email}
														</p>
													</div>
													{isOwner ? (
														<Badge variant="secondary" className="gap-1">
															<ShieldCheck
																className="size-3"
																aria-hidden="true"
															/>
															{t("teams.roleOwner")}
														</Badge>
													) : null}
													{/* The label is the action, not the current state: a
															    button reading "Member" gives no clue what clicking
															    it does. The hint sits on the wrapper because a
															    disabled button shows no tooltip, and a title there
															    would replace the label as the accessible name. */}
													<span
														title={
															isLastOwner ? t("teams.lastOwnerHint") : undefined
														}
													>
														<Button
															type="button"
															variant={isOwner ? "ghost" : "outline"}
															size="sm"
															disabled={pendingId === member._id || isLastOwner}
															onClick={() =>
																void changeRole(
																	member._id,
																	isOwner ? "member" : "owner",
																)
															}
														>
															{isOwner
																? t("teams.removeOwner")
																: t("teams.makeOwner")}
														</Button>
													</span>
												</li>
											);
										})}
									</ul>
								</CollapsibleContent>
							</Collapsible>
						</li>
					))}
				</ul>
			</div>
		</AdminSectionShell>
	);
}
