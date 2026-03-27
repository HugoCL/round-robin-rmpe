"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";

export default function OnboardingPage() {
	const t = useTranslations();
	const locale = useLocale();
	const router = useRouter();
	const onboardingState = useQuery(api.queries.getMyOnboardingState);
	const joinMyselfToTeam = useMutation(api.mutations.joinMyselfToTeam);
	const [selectedTeamSlug, setSelectedTeamSlug] = useState<string>("");
	const [isJoining, setIsJoining] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);

	const joinableTeams = onboardingState?.joinableTeams ?? [];
	const firstMemberTeamSlug = onboardingState?.memberTeamSlugs[0];
	const onboardingComplete =
		onboardingState?.isAdmin || onboardingState?.hasTeams || false;
	const canJoin = selectedTeamSlug.trim().length > 0 && !isJoining;

	useEffect(() => {
		if (onboardingComplete && firstMemberTeamSlug) {
			router.replace(`/${locale}/${firstMemberTeamSlug}`);
		}
	}, [firstMemberTeamSlug, locale, onboardingComplete, router]);

	const handleJoinTeam = async () => {
		if (!selectedTeamSlug || isJoining) return;
		setIsJoining(true);
		setJoinError(null);
		try {
			const result = await joinMyselfToTeam({ teamSlug: selectedTeamSlug });
			router.replace(`/${locale}/${result.teamSlug}`);
		} catch (_error) {
			setJoinError(t("onboarding.joinFailed"));
			setIsJoining(false);
		}
	};

	if (!onboardingState || (onboardingComplete && firstMemberTeamSlug)) {
		return (
			<div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-10">
				<div className="calm-section page-enter max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h2 className="text-xl font-semibold">{t("common.loading")}</h2>
					<p className="text-muted-foreground">{t("pr.loadingPleaseWait")}</p>
				</div>
			</div>
		);
	}

	if (onboardingState.isAdmin && !firstMemberTeamSlug) {
		return (
			<div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-10">
				<div className="calm-section page-enter max-w-xl text-center space-y-3">
					<p className="calm-kicker">La Lista</p>
					<h1 className="text-2xl font-semibold">
						{t("onboarding.adminTitle")}
					</h1>
					<p className="text-muted-foreground">
						{t("onboarding.adminDescription")}
					</p>
					<Button asChild>
						<Link href={`/${locale}`}>{t("onboarding.goHome")}</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8 md:py-10">
			<div className="mx-auto max-w-3xl space-y-4 text-center">
				<p className="calm-kicker">La Lista</p>
				<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
					{t("onboarding.title")}
				</h1>
				<p className="text-muted-foreground">{t("onboarding.description")}</p>
			</div>

			<div className="mt-8 grid gap-5 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>{t("onboarding.joinTitle")}</CardTitle>
						<CardDescription>{t("onboarding.joinDescription")}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{joinableTeams.length > 0 ? (
							<>
								<div className="space-y-2">
									<Label htmlFor="onboarding-team-select">
										{t("onboarding.selectTeamLabel")}
									</Label>
									<Select
										value={selectedTeamSlug}
										onValueChange={setSelectedTeamSlug}
									>
										<SelectTrigger id="onboarding-team-select">
											<SelectValue
												placeholder={t("onboarding.selectTeamPlaceholder")}
											/>
										</SelectTrigger>
										<SelectContent>
											{joinableTeams.map((team) => (
												<SelectItem key={team._id} value={team.slug}>
													{team.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								{joinError ? (
									<p className="text-sm text-destructive" role="alert">
										{joinError}
									</p>
								) : null}
								<Button onClick={handleJoinTeam} disabled={!canJoin}>
									{isJoining
										? t("onboarding.joining")
										: t("onboarding.joinCta")}
								</Button>
							</>
						) : (
							<p className="text-sm text-muted-foreground">
								{t("onboarding.noJoinableTeams")}
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t("onboarding.createTitle")}</CardTitle>
						<CardDescription>
							{t("onboarding.createDescription")}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							{t("onboarding.createHelper")}
						</p>
						<Button asChild variant="outline">
							<Link href={`/${locale}/create-team`}>
								{t("onboarding.createCta")}
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
