"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	normalizeWorkingDays,
	type PartTimeSchedule,
	type Weekday,
	WORKDAY_VALUES,
} from "@/lib/reviewerAvailability";

interface PartTimeScheduleFieldsProps {
	enabled: boolean;
	workingDays: Weekday[];
	onEnabledChange: (enabled: boolean) => void;
	onWorkingDaysChange: (workingDays: Weekday[]) => void;
	disabled?: boolean;
}

export function PartTimeScheduleFields({
	enabled,
	workingDays,
	onEnabledChange,
	onWorkingDaysChange,
	disabled = false,
}: PartTimeScheduleFieldsProps) {
	const t = useTranslations();
	const switchId = useId();
	const daysInvalid = enabled && workingDays.length === 0;

	return (
		<div className="flex flex-col gap-3">
			<Field orientation="horizontal" data-disabled={disabled || undefined}>
				<FieldContent>
					<FieldLabel htmlFor={switchId}>{t("partTime.title")}</FieldLabel>
					<FieldDescription>{t("partTime.description")}</FieldDescription>
				</FieldContent>
				<Switch
					id={switchId}
					className="shrink-0"
					checked={enabled}
					disabled={disabled}
					onCheckedChange={onEnabledChange}
				/>
			</Field>

			{enabled ? (
				<Field
					data-invalid={daysInvalid || undefined}
					data-disabled={disabled || undefined}
				>
					<ToggleGroup
						type="multiple"
						variant="outline"
						size="sm"
						spacing={1}
						value={workingDays}
						disabled={disabled}
						onValueChange={(value) =>
							onWorkingDaysChange(normalizeWorkingDays(value as Weekday[]))
						}
						className="w-full max-w-full"
						aria-label={t("partTime.workingDaysLabel")}
						aria-invalid={daysInvalid || undefined}
					>
						{WORKDAY_VALUES.map((day) => (
							<ToggleGroupItem
								key={day}
								value={day}
								className="min-w-0 flex-1 px-1.5 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/95"
								aria-label={t(`weekdays.${day}`)}
							>
								{t(`weekdays.${day}`)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					{daysInvalid ? (
						<FieldError>{t("partTime.pickDaysError")}</FieldError>
					) : (
						<FieldDescription>{t("partTime.helper")}</FieldDescription>
					)}
				</Field>
			) : null}
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
