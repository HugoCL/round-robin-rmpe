import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { cn } from "@/lib/utils";

/**
 * One line of the notice lane above the assignment card: icon, text, and
 * the action or ✕ at the end. No border or background, so it never outweighs
 * the card below it.
 */
export function NoticeLine({
	icon: Icon,
	children,
	action,
	onDismiss,
	className,
}: {
	icon: LucideIcon;
	children: ReactNode;
	action?: ReactNode;
	onDismiss?: () => void;
	className?: string;
}) {
	const t = useTranslations("announcements");

	return (
		<div
			data-notice
			className={cn(
				"flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1 text-sm text-muted-foreground",
				className,
			)}
		>
			<Icon className="size-4 shrink-0" aria-hidden="true" />
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
				{children}
			</div>
			{action}
			{onDismiss ? (
				<IconActionButton
					label={t("dismiss")}
					className="size-8 text-muted-foreground"
					onClick={onDismiss}
				>
					<X />
				</IconActionButton>
			) : null}
		</div>
	);
}
