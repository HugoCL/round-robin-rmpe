import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const buttonGroupVariants = cva(
	" has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]: flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
	{
		variants: {
			orientation: {
				horizontal:
					"[&>*:not(:first-child)]: [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:",
				vertical:
					"flex-col [&>*:not(:first-child)]: [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:",
			},
		},
		defaultVariants: {
			orientation: "horizontal",
		},
	},
);

function ButtonGroup({
	className,
	orientation,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
	return (
		<div
			role="group"
			data-slot="button-group"
			data-orientation={orientation}
			className={cn(buttonGroupVariants({ orientation }), className)}
			{...props}
		/>
	);
}

function ButtonGroupText({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"div"> & {
	asChild?: boolean;
}) {
	const Comp = asChild ? Slot.Root : "div";

	return (
		<Comp
			className={cn(
				"bg-muted gap-2  border px-2.5 text-xs font-medium [&_svg:not([class*='size-'])]:size-4 flex items-center [&_svg]:pointer-events-none",
				className,
			)}
			{...props}
		/>
	);
}

function ButtonGroupSeparator({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="button-group-separator"
			orientation={orientation}
			className={cn(
				"bg-input relative self-stretch data-[orientation=horizontal]:mx-px data-[orientation=horizontal]:w-auto data-[orientation=vertical]:my-px data-[orientation=vertical]:h-auto",
				className,
			)}
			{...props}
		/>
	);
}

export {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
	buttonGroupVariants,
};
