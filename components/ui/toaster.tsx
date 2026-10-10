"use client";

import { AlertTriangle } from "lucide-react";
import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, action, ...props }) => (
				<Toast key={id} {...props}>
					{props.variant === "destructive" ? (
						<AlertTriangle
							className="size-4 shrink-0 self-start text-red-700 dark:text-red-300"
							aria-hidden="true"
						/>
					) : null}
					<div className="grid min-w-0 flex-1 gap-1">
						{title && <ToastTitle>{title}</ToastTitle>}
						{description && <ToastDescription>{description}</ToastDescription>}
					</div>
					{action}
					<ToastClose />
				</Toast>
			))}
			<ToastViewport />
		</ToastProvider>
	);
}
