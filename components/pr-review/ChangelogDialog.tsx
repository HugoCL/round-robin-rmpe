"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	focusDialogItself,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	type ChangelogEntry,
	changelogEntries,
	changelogTypeColors,
	changelogTypeLabels,
} from "@/lib/changelog";

function formatDate(dateStr: string, locale: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
	const date = match
		? new Date(
				Date.UTC(
					Number.parseInt(match[1], 10),
					Number.parseInt(match[2], 10) - 1,
					Number.parseInt(match[3], 10),
					12,
				),
			)
		: new Date(dateStr);
	return date.toLocaleDateString(locale.startsWith("es") ? "es-ES" : "en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

function ChangelogContent({ entries }: { entries: ChangelogEntry[] }) {
	const t = useTranslations("changelog");
	const locale = useLocale();

	return (
		<ScrollArea className="h-[400px] pr-4">
			<div className="relative ml-3">
				{/* Timeline line */}
				<div className="absolute left-0 top-1 bottom-0 w-0.5 bg-primary/20" />

				<div className="space-y-6">
					{entries.map((entry) => (
						<div key={`${entry.date}-${entry.title}`} className="relative pl-6">
							{/* Timeline dot */}
							<div className="absolute left-[-3px] top-1 h-2 w-2  bg-primary" />

							{/* Date and type badges */}
							<div className="mb-2 flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center  bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
									{formatDate(entry.date, locale)}
								</span>
								<span
									className={`inline-flex items-center  px-2.5 py-0.5 text-xs font-medium ${changelogTypeColors[entry.type]}`}
								>
									{changelogTypeLabels[entry.type]}
								</span>
							</div>

							{/* Title */}
							<h4 className="font-semibold text-sm mb-1">{entry.title}</h4>

							{/* Description */}
							<p className="text-sm text-muted-foreground leading-relaxed">
								{entry.description}
							</p>
							{entry.suggestedBy && (
								<p className="mt-2 text-xs text-muted-foreground">
									{t("suggestedBy", { name: entry.suggestedBy })}
								</p>
							)}
						</div>
					))}
				</div>
			</div>

			{entries.length === 0 && (
				<p className="text-sm text-muted-foreground text-center py-8">
					{t("noChanges")}
				</p>
			)}
		</ScrollArea>
	);
}

/** Opened from the header menu, which owns its state. */
export function ChangelogDialog({
	open,
	onOpenChange: setOpen,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const isMobile = useIsMobile();
	const tCommon = useTranslations("common");
	const tChangelog = useTranslations("changelog");

	const title = tChangelog("title");
	const description = tChangelog("description");

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerContent onOpenAutoFocus={focusDialogItself}>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<div className="px-4 pb-4">
						<ChangelogContent entries={changelogEntries} />
					</div>
					<DrawerFooter>
						<DrawerClose asChild>
							<Button variant="outline">{tCommon("close")}</Button>
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				className="sm:max-w-[500px]"
				onOpenAutoFocus={focusDialogItself}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<ChangelogContent entries={changelogEntries} />
			</DialogContent>
		</Dialog>
	);
}
