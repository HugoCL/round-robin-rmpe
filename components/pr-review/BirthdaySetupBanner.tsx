"use client";

import { Cake, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidCalendarBirthday } from "@/lib/reviewerAvailability";
import { usePRReview } from "./PRReviewContext";

function daysForMonth(month: number): number[] {
	const out: number[] = [];
	for (let d = 1; d <= 31; d++) {
		if (isValidCalendarBirthday(month, d)) out.push(d);
	}
	return out;
}

export function BirthdaySetupBanner() {
	const t = useTranslations("birthday");
	const locale = useLocale();
	const {
		reviewers,
		userInfo,
		setReviewerBirthday,
		canManageCurrentTeam,
		teamSlug,
	} = usePRReview();

	const [month, setMonth] = useState<string>("");
	const [day, setDay] = useState<string>("");
	const [saving, setSaving] = useState(false);
	const [open, setOpen] = useState(false);

	const monthLabels = useMemo(() => {
		const fmt = new Intl.DateTimeFormat(locale, { month: "long" });
		return Array.from({ length: 12 }, (_, i) => ({
			value: String(i + 1),
			label: fmt.format(new Date(2024, i, 1)),
		}));
	}, [locale]);

	const monthNum = month ? Number.parseInt(month, 10) : NaN;
	const validDays = Number.isFinite(monthNum) ? daysForMonth(monthNum) : [];

	if (!teamSlug || !canManageCurrentTeam || !userInfo?.email) return null;

	const row = reviewers.find(
		(r) => r.email.toLowerCase() === userInfo.email.toLowerCase(),
	);
	if (!row) return null;
	if (row.birthdayMonth !== undefined && row.birthdayDay !== undefined) {
		return null;
	}

	const id = row._id as Id<"reviewers">;

	const onSave = async () => {
		const m = Number.parseInt(month, 10);
		const d = Number.parseInt(day, 10);
		if (
			!Number.isFinite(m) ||
			!Number.isFinite(d) ||
			!isValidCalendarBirthday(m, d)
		) {
			return;
		}
		setSaving(true);
		try {
			await setReviewerBirthday(id, m, d);
		} finally {
			setSaving(false);
		}
	};

	const canSave =
		month.length > 0 &&
		day.length > 0 &&
		isValidCalendarBirthday(
			Number.parseInt(month, 10),
			Number.parseInt(day, 10),
		);

	return (
		<Collapsible open={open} onOpenChange={setOpen} data-notice>
			<Alert className="rounded-xl border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-foreground shadow-none sm:px-4">
				<Cake className="text-primary" />
				<div className="col-start-2 flex min-w-0 items-center gap-3">
					<div className="min-w-0 flex-1">
						<AlertTitle>{t("setupTitle")}</AlertTitle>
						<AlertDescription className="line-clamp-1 text-xs sm:text-sm">
							{t("setupDescription")}
						</AlertDescription>
					</div>
					<CollapsibleTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-label={t("setupAction")}
						>
							<span className="hidden sm:inline">{t("setupAction")}</span>
							<ChevronDown
								data-icon="inline-end"
								className={
									open
										? "rotate-180 transition-transform"
										: "transition-transform"
								}
							/>
						</Button>
					</CollapsibleTrigger>
				</div>
				<CollapsibleContent className="col-span-full mt-3 border-t border-border/60 pt-3">
					<AlertDescription>
						<FieldGroup className="gap-3 sm:flex-row sm:items-end">
							<Field className="sm:max-w-48">
								<FieldLabel htmlFor="birthday-month" className="text-xs">
									{t("monthLabel")}
								</FieldLabel>
								<Select
									value={month || undefined}
									onValueChange={(v) => {
										setMonth(v);
										setDay("");
									}}
								>
									<SelectTrigger id="birthday-month" className="w-full">
										<SelectValue placeholder={t("placeholderMonth")} />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{monthLabels.map((m) => (
												<SelectItem key={m.value} value={m.value}>
													{m.label}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>
							<Field className="sm:max-w-28">
								<FieldLabel htmlFor="birthday-day" className="text-xs">
									{t("dayLabel")}
								</FieldLabel>
								<Select
									value={day || undefined}
									onValueChange={setDay}
									disabled={!month}
								>
									<SelectTrigger id="birthday-day" className="w-full">
										<SelectValue placeholder={t("placeholderDay")} />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{validDays.map((d) => (
												<SelectItem key={d} value={String(d)}>
													{d}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>
							<Button
								type="button"
								size="sm"
								className="w-full shrink-0 sm:w-auto"
								disabled={!canSave || saving}
								onClick={() => void onSave()}
							>
								{saving ? t("saving") : t("save")}
							</Button>
						</FieldGroup>
					</AlertDescription>
				</CollapsibleContent>
			</Alert>
		</Collapsible>
	);
}
