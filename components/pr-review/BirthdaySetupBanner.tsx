"use client";

import { Cake } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
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
		<Alert className="border-fuchsia-500/35 bg-fuchsia-500/[0.06] text-fuchsia-950 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-50">
			<Cake className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-300" />
			<AlertTitle>{t("setupTitle")}</AlertTitle>
			<AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
				<p className="text-sm text-fuchsia-900/90 dark:text-fuchsia-50/90">
					{t("setupDescription")}
				</p>
				<div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
					<div className="flex flex-wrap gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor="birthday-month" className="text-xs">
								{t("monthLabel")}
							</Label>
							<Select
								value={month || undefined}
								onValueChange={(v) => {
									setMonth(v);
									setDay("");
								}}
							>
								<SelectTrigger
									id="birthday-month"
									className="w-[min(100vw-3rem,12rem)]"
								>
									<SelectValue placeholder={t("placeholderMonth")} />
								</SelectTrigger>
								<SelectContent>
									{monthLabels.map((m) => (
										<SelectItem key={m.value} value={m.value}>
											{m.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="birthday-day" className="text-xs">
								{t("dayLabel")}
							</Label>
							<Select
								value={day || undefined}
								onValueChange={setDay}
								disabled={!month}
							>
								<SelectTrigger
									id="birthday-day"
									className="w-[min(100vw-3rem,7rem)]"
								>
									<SelectValue placeholder={t("placeholderDay")} />
								</SelectTrigger>
								<SelectContent>
									{validDays.map((d) => (
										<SelectItem key={d} value={String(d)}>
											{d}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<Button
						type="button"
						size="sm"
						className="w-fit shrink-0"
						disabled={!canSave || saving}
						onClick={() => void onSave()}
					>
						{saving ? t("saving") : t("save")}
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	);
}
