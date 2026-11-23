"use client";

import { LayoutPanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useWidgetLayout } from "../widgets/WidgetLayoutContext";

/** Opens the mode where widgets can be moved, added and removed. */
export function PersonalizeButton() {
	const t = useTranslations("widgets");
	const { editing, setEditing } = useWidgetLayout();
	const buttonRef = useRef<HTMLButtonElement>(null);
	const wasEditing = useRef(false);

	// The button is hidden while customizing, so focus comes back to it after.
	useEffect(() => {
		if (wasEditing.current && !editing) buttonRef.current?.focus();
		wasEditing.current = editing;
	}, [editing]);

	if (editing) return null;

	return (
		<Button
			ref={buttonRef}
			variant="ghost"
			size="sm"
			aria-label={t("personalize")}
			className="h-9 gap-2 rounded-full px-3 font-normal text-muted-foreground hover:bg-muted/40 hover:text-foreground max-sm:size-9 max-sm:px-0"
			onClick={() => setEditing(true)}
		>
			<LayoutPanelLeft className="size-4" aria-hidden="true" />
			<span className="max-sm:sr-only">{t("personalize")}</span>
		</Button>
	);
}
