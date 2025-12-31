"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	type ChangelogEntry,
	changelogEntries,
	changelogTypeColors,
	changelogTypeLabels,
} from "@/lib/changelog";

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("es-ES", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function ChangelogContent({ entries }: { entries: ChangelogEntry[] }) {
	return (
		<ScrollArea className="h-[400px] pr-4">
			<div className="relative ml-3">
				{/* Timeline line */}
				<div className="absolute left-0 top-1 bottom-0 w-0.5 bg-primary/20" />

				<div className="space-y-6">
					{entries.map((entry, index) => (
						<div key={`${entry.date}-${index}`} className="relative pl-6">
							{/* Timeline dot */}
							<div className="absolute left-[-3px] top-1 h-2 w-2 rounded-full bg-primary" />

							{/* Date and type badges */}
							<div className="mb-2 flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
									{formatDate(entry.date)}
								</span>
								<span
									className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${changelogTypeColors[entry.type]}`}
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
						</div>
					))}
				</div>
			</div>

			{entries.length === 0 && (
				<p className="text-sm text-muted-foreground text-center py-8">
					No hay cambios registrados aún.
				</p>
			)}
		</ScrollArea>
	);
}

export function ChangelogDialog() {
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobile();

	const title = "Novedades";
	const description = "Últimos cambios y mejoras de la aplicación";

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="flex items-center gap-1"
					>
						<History className="h-4 w-4" />
						<span className="hidden sm:inline">{title}</span>
					</Button>
				</DrawerTrigger>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<div className="px-4 pb-4">
						<ChangelogContent entries={changelogEntries} />
					</div>
					<DrawerFooter>
						<DrawerClose asChild>
							<Button variant="outline">Cerrar</Button>
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-1">
					<History className="h-4 w-4" />
					<span className="hidden sm:inline">{title}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<ChangelogContent entries={changelogEntries} />
			</DialogContent>
		</Dialog>
	);
}
