"use client";

import type { ReactNode } from "react";

/**
 * One calm-section per admin section.
 *
 * Exists so sections never nest a calm-section inside another one, which the
 * design system forbids and which is easy to do by accident once sections get
 * their own sub-panels.
 */
export function AdminSectionShell({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="calm-section page-enter-soft space-y-4">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 space-y-1">
					<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
					{description ? (
						<p className="text-pretty text-sm text-muted-foreground">
							{description}
						</p>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</header>
			{children}
		</section>
	);
}
