"use client";

import { createToaster } from "@ui-sdk/react/toast";
import type * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

/**
 * The app's toast queue, shown by `<Toaster />`. `toast()` and `useToast()`
 * keep the API of the Radix version on top of ui-sdk's toaster.
 */
const toaster = createToaster<React.ReactNode>();

type ToasterToast = ToastProps & {
	id: string;
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;

/** What `<Toaster />` reads from each toast's `data`. */
type ToastData = {
	variant: NonNullable<ToastProps["variant"]>;
	action?: ToastActionElement;
};

function toOptions({ title, description, variant, action, duration }: Toast) {
	const data: ToastData = { variant: variant ?? "default", action };
	return {
		title,
		description,
		duration,
		type: variant === "destructive" ? ("error" as const) : ("default" as const),
		// Radix announced every toast assertively.
		priority: "assertive" as const,
		data,
	};
}

function toast(props: Toast) {
	// One toast at a time: a new one replaces the one showing, as before.
	toaster.dismiss();
	const id = toaster(toOptions(props));
	return {
		id,
		dismiss: () => toaster.dismiss(id),
		update: (next: ToasterToast) => toaster.update(id, toOptions(next)),
	};
}

function useToast() {
	return {
		toast,
		dismiss: (toastId?: string) => toaster.dismiss(toastId),
	};
}

export { type ToastData, toast, toaster, useToast };
