"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { focusTool, isKeyboardClick } from "./WidgetFrame";
import { useWidgetLayout } from "./WidgetLayoutContext";

/**
 * The bar that shows while customizing: what can be added, reset and done.
 * It sits in the sticky header on desktop and at the bottom on phones, where
 * the header scrolls away.
 */
export function WidgetEditBar() {
	const t = useTranslations("widgets");
	const {
		editing,
		addable,
		add,
		reset,
		isCustomized,
		setEditing,
		setDraggingId,
	} = useWidgetLayout();

	if (!editing) return null;

	return (
		<section
			aria-label={t("editing")}
			className="border-t border-primary/25 bg-[color-mix(in_oklab,var(--primary)_7%,var(--background))] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:pb-[env(safe-area-inset-bottom)]"
		>
			<div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
				{/* On a phone the dashed widgets already say which mode this is. */}
				<h2 className="text-base font-semibold max-sm:sr-only">
					{t("editing")}
				</h2>
				<p className="text-sm text-muted-foreground max-lg:hidden">
					{t("editHint")}
				</p>
				{addable.length > 0 ? (
					<ul
						className="flex flex-wrap items-center gap-1.5 max-lg:order-last max-lg:basis-full"
						aria-label={t("addGroup")}
					>
						{addable.map((id) => (
							<li key={id}>
								<button
									type="button"
									draggable
									onDragStart={(event) => {
										event.dataTransfer.effectAllowed = "move";
										event.dataTransfer.setData("text/plain", id);
										setDraggingId(id);
									}}
									onDragEnd={() => setDraggingId(null)}
									onClick={(event) => {
										// The chip is gone once its widget is in the view.
										const follow = isKeyboardClick(event);
										void add(id).then(() => follow && focusTool(id, "up"));
									}}
									aria-label={t("add", { name: t(`titles.${id}`) })}
									className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-control-border bg-background pr-3 pl-2 text-xs font-medium transition-[border-color,color,scale] duration-150 hover:border-primary hover:border-solid hover:text-primary active:scale-[0.96] lg:h-8"
								>
									<Plus className="size-3.5" aria-hidden="true" />
									{t(`titles.${id}`)}
								</button>
							</li>
						))}
					</ul>
				) : null}
				<div className="ml-auto flex items-center gap-1.5">
					<Button
						variant="ghost"
						size="sm"
						disabled={!isCustomized}
						onClick={reset}
					>
						{t("reset")}
					</Button>
					{/* The button that opened this mode is gone, so the keyboard lands here. */}
					<Button
						size="sm"
						autoFocus
						data-widget-done
						onClick={() => setEditing(false)}
					>
						<Check data-icon="inline-start" />
						{t("done")}
					</Button>
				</div>
			</div>
		</section>
	);
}
