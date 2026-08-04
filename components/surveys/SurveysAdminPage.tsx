"use client";

import { useMutation, useQuery } from "convex/react";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";

function statusLabel(
	t: ReturnType<typeof useTranslations<"survey">>,
	status: "draft" | "active" | "closed",
) {
	switch (status) {
		case "draft":
			return t("admin.statusDraft");
		case "active":
			return t("admin.statusActive");
		case "closed":
			return t("admin.statusClosed");
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export function SurveysAdminPage() {
	const t = useTranslations("survey");
	const locale = useLocale();
	const router = useRouter();
	const { toast } = useToast();
	const access = useQuery(api.surveys.isSurveyAdmin);
	const surveys = useQuery(
		api.surveys.listSurveys,
		access?.isAdmin ? {} : "skip",
	);
	const createSurvey = useMutation(api.surveys.createSurvey);
	const [creating, setCreating] = useState(false);

	if (access === undefined) {
		return (
			<main className="container mx-auto max-w-5xl px-4 py-8">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="mt-6 h-40 w-full" />
			</main>
		);
	}

	if (!access.isAdmin) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("admin.unauthorizedTitle")}
				</h1>
				<p className="mt-2 text-muted-foreground">
					{t("admin.unauthorizedDescription")}
				</p>
			</main>
		);
	}

	const create = async (usePmfTemplate: boolean) => {
		setCreating(true);
		try {
			const deadlineAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
			const surveyId = await createSurvey({
				titleEn: usePmfTemplate ? "Product–market fit check" : "New survey",
				titleEs: usePmfTemplate
					? "Chequeo de product–market fit"
					: "Nueva encuesta",
				descriptionEn: usePmfTemplate
					? "Help us understand if La Lista is ready for more teams."
					: undefined,
				descriptionEs: usePmfTemplate
					? "Ayúdanos a entender si La Lista está lista para más equipos."
					: undefined,
				deadlineAt,
				usePmfTemplate,
			});
			toast({
				title: t("admin.messages.createdTitle"),
				description: t("admin.messages.createdDescription"),
			});
			router.push(`/${locale}/surveys/${surveyId}`);
		} catch {
			toast({
				title: t("admin.messages.createFailed"),
				variant: "destructive",
			});
		} finally {
			setCreating(false);
		}
	};

	return (
		<main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
			<div className="space-y-6">
				<header className="page-enter-soft flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-2">
						<p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
							<ClipboardList className="h-4 w-4" />
							La Lista
						</p>
						<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
							{t("admin.title")}
						</h1>
						<p className="max-w-2xl text-muted-foreground">
							{t("admin.subtitle")}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={creating}
							onClick={() => void create(false)}
						>
							{t("admin.create")}
						</Button>
						<Button
							type="button"
							disabled={creating}
							onClick={() => void create(true)}
						>
							{t("admin.createWithTemplate")}
						</Button>
					</div>
				</header>

				{surveys === undefined ? (
					<Skeleton className="h-48 w-full" />
				) : surveys.length === 0 ? (
					<p className="text-muted-foreground">{t("admin.empty")}</p>
				) : (
					<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
						{surveys.map((survey) => {
							const title = locale === "es" ? survey.titleEs : survey.titleEn;
							return (
								<li key={survey._id}>
									<Link
										href={`/${locale}/surveys/${survey._id}`}
										className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
									>
										<div className="space-y-1">
											<p className="font-medium">{title}</p>
											<p className="text-sm text-muted-foreground">
												{statusLabel(t, survey.status)} ·{" "}
												{t("admin.responses", {
													count: survey.responseCount,
												})}
											</p>
										</div>
										<p className="text-sm text-muted-foreground">
											{t("admin.deadline")}:{" "}
											{new Date(survey.deadlineAt).toLocaleString(locale)}
										</p>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</main>
	);
}
