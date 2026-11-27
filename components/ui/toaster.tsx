"use client";

import { AlertTriangle } from "lucide-react";
import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import { type ToastData, toaster } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function Toaster() {
	// Toasts sit at the top on phones and bottom right from `sm` up; swiping
	// toward that edge dismisses them.
	const fromSm = useMediaQuery("(min-width: 640px)");

	return (
		<ToastViewport
			toaster={toaster}
			side={fromSm ? "bottom" : "top"}
			align="end"
			maxVisible={1}
			// F8 reached the toasts before ui-sdk (Radix's hotkey); keep it.
			shortcut="F8"
		>
			{(item) => {
				const data = item.data as ToastData | undefined;
				const destructive = data?.variant === "destructive";
				return (
					<Toast variant={data?.variant}>
						{destructive ? (
							<AlertTriangle
								className="size-4 shrink-0 self-start text-red-700 dark:text-red-300"
								aria-hidden="true"
							/>
						) : null}
						<div className="grid min-w-0 flex-1 gap-1">
							<ToastTitle />
							<ToastDescription />
						</div>
						{data?.action}
						<ToastClose />
					</Toast>
				);
			}}
		</ToastViewport>
	);
}
