"use client";

import type * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarBase({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-3", className)}
			classNames={{
				today: "border border-accent",
				selected:
					"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
				root: `${defaultClassNames.root} shadow-lg`,
				chevron: `${defaultClassNames.chevron} fill-primary`,
				...classNames,
			}}
			{...props}
		/>
	);
}

CalendarBase.displayName = "Calendar";
export { CalendarBase as Calendar };
