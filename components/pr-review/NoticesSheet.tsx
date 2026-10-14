"use client";

import { useTranslations } from "next-intl";
import { focusDialogItself } from "@/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { BirthdaySetupBanner } from "./BirthdaySetupBanner";
import { SurveyBanner } from "./SurveyBanner";

/**
 * Product notices (announcements, surveys, setup nudges) live here, off the
 * assignment page: they are about La Lista, not about today's PR.
 */
export function NoticesSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("announcements");

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				className="gap-0 rounded-none p-0 data-[side=right]:sm:max-w-lg"
				onOpenAutoFocus={focusDialogItself}
			>
				<SheetHeader className="p-5 pr-14">
					<SheetTitle>{t("title")}</SheetTitle>
					<SheetDescription>{t("sheetDescription")}</SheetDescription>
				</SheetHeader>
				<div className="peer flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 empty:hidden">
					<AnnouncementBanner />
					<SurveyBanner />
					<BirthdaySetupBanner />
				</div>
				{/* Every banner renders nothing when it does not apply, so CSS knows. */}
				<p className="hidden p-5 text-sm text-muted-foreground peer-empty:block">
					{t("empty")}
				</p>
			</SheetContent>
		</Sheet>
	);
}
