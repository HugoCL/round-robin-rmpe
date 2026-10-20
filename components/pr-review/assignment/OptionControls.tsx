import { AlertTriangle, type LucideIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Option chips share one pill shape. They are 44px tall so they stay comfortable
 * to tap, and their width comes from their own label — never from a fixed column
 * that would clip it.
 */
export const assignmentChipClass =
	"inline-flex h-11 min-w-0 max-w-full shrink-0 basis-auto items-center justify-center gap-2.5 rounded-full border-border/70 bg-transparent px-3.5 text-xs text-foreground transition-colors duration-150 lg:px-4 lg:text-sm";

const urgentActiveClass =
	"aria-pressed:bg-red-600 aria-pressed:border-red-600 aria-pressed:text-white hover:aria-pressed:bg-red-600/90 dark:aria-pressed:bg-red-700 dark:aria-pressed:border-red-700";

/** The one Urgent control, so the card and its dialogs look and act alike. */
export function UrgentToggle({
	pressed,
	onPressedChange,
	id,
}: {
	pressed: boolean;
	onPressedChange: (pressed: boolean) => void;
	id?: string;
}) {
	const t = useTranslations();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Toggle
						id={id}
						pressed={pressed}
						onPressedChange={onPressedChange}
						variant="outline"
						size="sm"
						aria-label={t("googleChat.urgentToggle")}
						className={cn(assignmentChipClass, pressed && urgentActiveClass)}
					>
						<AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
						<span className="min-w-0 truncate leading-none">
							{t("googleChat.urgentToggle")}
						</span>
					</Toggle>
				</TooltipTrigger>
				{/* Beside the chip, so keyboard focus does not cover the PR field above. */}
				<TooltipContent side="right" className="max-w-64 text-xs">
					<p>{t("googleChat.urgentToggleDescription")}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * One added line of the form (context link, teams, message): icon, label,
 * the field, and a ✕ that takes the line away again.
 */
export function ExtraRow({
	label,
	icon: Icon,
	onRemove,
	children,
}: {
	label: string;
	icon: LucideIcon;
	onRemove: () => void;
	children: ReactNode;
}) {
	const t = useTranslations();

	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 sm:grid-cols-[auto_5.5rem_minmax(0,1fr)_auto]">
			<Icon
				className="mt-2.5 size-4 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<span className="mt-2 text-sm font-medium text-muted-foreground">
				{label}
			</span>
			<div className="col-span-3 flex min-w-0 flex-col gap-2 sm:col-span-1">
				{children}
			</div>
			{/* On phones the field takes the second row; ✕ stays at the end of the first. */}
			<div className="col-start-3 row-start-1 sm:col-start-4">
				<IconActionButton
					label={t("pr.chipRemove", { label })}
					onClick={onRemove}
					className="-mt-0.5 -mr-2 text-muted-foreground"
				>
					<X />
				</IconActionButton>
			</div>
		</div>
	);
}

/** An on/off option with its meaning spelled out next to it, not in a tooltip. */
export function OptionSwitch({
	id,
	label,
	description,
	checked,
	onCheckedChange,
}: {
	id: string;
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-start gap-3">
			<Switch
				id={id}
				checked={checked}
				onCheckedChange={onCheckedChange}
				className="mt-0.5"
			/>
			<div className="flex min-w-0 flex-col gap-0.5">
				<Label htmlFor={id} className="cursor-pointer text-sm font-medium">
					{label}
				</Label>
				<p className="text-xs text-muted-foreground lg:text-sm">
					{description}
				</p>
			</div>
		</div>
	);
}
