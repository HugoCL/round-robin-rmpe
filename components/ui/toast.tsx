"use client";

import {
	ToastAction as ToastActionPrimitive,
	ToastClose as ToastClosePrimitive,
	ToastDescription as ToastDescriptionPrimitive,
	Toast as ToastPrimitive,
	ToastRegion,
	ToastTitle as ToastTitlePrimitive,
} from "@ui-sdk/react/toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Kept for call sites from the Radix version: ui-sdk needs no provider. */
function ToastProvider({ children }: { children?: React.ReactNode }) {
	return <>{children}</>;
}

/**
 * Where toasts show: across the top on phones, bottom right from `sm` up.
 * ui-sdk renders a `section` with the toasts in an `ol` inside it.
 */
function ToastViewport({
	className,
	...props
}: React.ComponentProps<typeof ToastRegion>) {
	return (
		<ToastRegion
			className={cn(
				"fixed top-0 right-0 z-[100] flex max-h-screen w-full p-4 sm:top-auto sm:bottom-0 md:max-w-[420px] [&>ol]:relative [&>ol]:flex [&>ol]:w-full [&>ol]:flex-col-reverse sm:[&>ol]:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

const toastVariants = cva(
	// A toast that is leaving steps out of the flow, so the one replacing it
	// takes its place at once, as Radix's single-toast queue did.
	"group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-2xl border p-6 pr-8 shadow-lg transition-[translate,opacity] select-none [translate:var(--toast-swipe-x,0px)_0] animate-in slide-in-from-top-full sm:slide-in-from-bottom-full data-swiping:transition-none data-ending-style:absolute data-ending-style:inset-x-0 data-ending-style:animate-out data-ending-style:fade-out-80 data-ending-style:slide-out-to-right-full",
	{
		variants: {
			variant: {
				default: "border bg-background text-foreground",
				destructive:
					"destructive group border-destructive/60 bg-background text-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Toast({
	className,
	variant,
	...props
}: React.ComponentProps<typeof ToastPrimitive> &
	VariantProps<typeof toastVariants>) {
	return (
		<ToastPrimitive
			data-variant={variant ?? "default"}
			className={cn(toastVariants({ variant }), className)}
			{...props}
		/>
	);
}

/**
 * The toast's button, with Radix's props: `onClick` runs it and the toast
 * closes. `altText` is kept for call sites; ui-sdk announces the toast's own
 * text and the button's label.
 */
function ToastAction({
	className,
	altText: _altText,
	onClick,
	...props
}: Omit<React.ComponentProps<typeof ToastActionPrimitive>, "onClick"> & {
	altText?: string;
	onClick?: (event: Event | undefined) => void;
}) {
	return (
		<ToastActionPrimitive
			className={cn(
				"inline-flex h-8 shrink-0 items-center justify-center rounded-full border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-destructive/40 group-[.destructive]:text-red-700 group-[.destructive]:hover:bg-destructive/10 group-[.destructive]:focus:ring-destructive dark:group-[.destructive]:text-red-300",
				className,
			)}
			onAction={
				onClick
					? (event) => {
							// Not returned: a Promise would keep the toast open as pending.
							onClick(event);
						}
					: undefined
			}
			{...props}
		/>
	);
}

function ToastClose({
	className,
	...props
}: React.ComponentProps<typeof ToastClosePrimitive>) {
	return (
		<ToastClosePrimitive
			className={cn(
				"absolute right-2 top-2 rounded-full p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
				className,
			)}
			{...props}
		>
			<X className="h-4 w-4" />
		</ToastClosePrimitive>
	);
}

function ToastTitle({
	className,
	...props
}: React.ComponentProps<typeof ToastTitlePrimitive>) {
	return (
		<ToastTitlePrimitive
			className={cn(
				"text-sm font-semibold group-[.destructive]:text-red-700 dark:group-[.destructive]:text-red-300",
				className,
			)}
			{...props}
		/>
	);
}

function ToastDescription({
	className,
	...props
}: React.ComponentProps<typeof ToastDescriptionPrimitive>) {
	return (
		<ToastDescriptionPrimitive className={cn("text-sm", className)} {...props} />
	);
}

type ToastProps = { variant?: "default" | "destructive"; duration?: number };

type ToastActionElement = React.ReactElement<
	React.ComponentProps<typeof ToastAction>
>;

export {
	Toast,
	ToastAction,
	type ToastActionElement,
	ToastClose,
	ToastDescription,
	type ToastProps,
	ToastProvider,
	ToastTitle,
	ToastViewport,
};
