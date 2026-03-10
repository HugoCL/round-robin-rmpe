"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	normalizeWorkingDays,
	type PartTimeSchedule,
	type Weekday,
	WORKDAY_VALUES,
} from "@/lib/reviewerAvailability";
import { cn } from "@/lib/utils";

interface PartTimeScheduleFieldsProps {
	enabled: boolean;
	workingDays: Weekday[];
	onEnabledChange: (enabled: boolean) => void;
	onWorkingDaysChange: (workingDays: Weekday[]) => void;
}

export function PartTimeScheduleFields({
	enabled,
	workingDays,
	onEnabledChange,
	onWorkingDaysChange,
}: PartTimeScheduleFieldsProps) {
	const t = useTranslations();

	const toggleWorkingDay = (day: Weekday) => {
		const nextWorkingDays = workingDays.includes(day)
			? workingDays.filter((value) => value !== day)
			: normalizeWorkingDays([...workingDays, day]);
		onWorkingDaysChange(nextWorkingDays);
	};

	return (
		<div className="space-y-3 rounded-md border border-border/70 p-3">
			<div className="flex items-center justify-between gap-3">
				<div className="space-y-1">
					<Label>{t("partTime.title")}</Label>
					<p className="text-xs text-muted-foreground">
						{t("partTime.description")}
					</p>
				</div>
				<Switch checked={enabled} onCheckedChange={onEnabledChange} />
			</div>

			{enabled ? (
				<div className="space-y-2">
					<div className="flex flex-wrap gap-2">
						{WORKDAY_VALUES.map((day) => {
							const selected = workingDays.includes(day);
							return (
								<Button
									key={day}
									type="button"
									variant={selected ? "default" : "outline"}
									size="sm"
									aria-pressed={selected}
									className={cn(
										"capitalize",
										!selected && "text-muted-foreground",
									)}
									onClick={() => toggleWorkingDay(day)}
								>
									{t(`weekdays.${day}`)}
								</Button>
							);
						})}
					</div>
					<p className="text-xs text-muted-foreground">
						{t("partTime.helper")}
					</p>
				</div>
			) : (
				<p className="text-xs text-muted-foreground">
					{t("partTime.fullTimeHint")}
				</p>
			)}
		</div>
	);
}

export function scheduleFromSelection(
	enabled: boolean,
	workingDays: Weekday[],
): PartTimeSchedule | undefined {
	if (!enabled || workingDays.length === 0) {
		return undefined;
	}

	return {
		workingDays: normalizeWorkingDays(workingDays),
	};
}
