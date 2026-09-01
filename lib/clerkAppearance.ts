import { enUS, esES } from "@clerk/localizations";

/**
 * Shared Clerk look & feel so sign-in and sign-up stay on the design system.
 *
 * The card keeps a real surface (background, border, shadow): a transparent
 * card leaves the social button reading as plain text instead of the only
 * control on the screen.
 */
export const clerkAppearance = {
	variables: {
		colorBackground: "var(--card)",
		colorPrimary: "var(--primary)",
		colorPrimaryForeground: "var(--primary-foreground)",
		colorForeground: "var(--foreground)",
		colorMutedForeground: "var(--muted-foreground)",
		colorInput: "var(--muted)",
		colorInputForeground: "var(--foreground)",
		colorBorder: "var(--border)",
		colorRing: "var(--ring)",
		borderRadius: "0.75rem",
	},
	elements: {
		rootBox: "w-full",
		cardBox:
			"w-full rounded-3xl border border-border/70 !shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] dark:!shadow-[0_24px_80px_-36px_rgba(0,0,0,0.75)]",
		card: "w-full border-0 !bg-card p-6 sm:p-8 !shadow-none",
		header: "items-start text-left",
		headerTitle: "font-display text-2xl font-semibold tracking-tight",
		headerSubtitle: "text-left",
		socialButtonsBlockButton:
			"!border !border-border/70 !bg-background hover:!bg-muted/50 !shadow-none",
		formButtonPrimary: "rounded-full !shadow-none",
		footer: "!bg-none !bg-transparent",
	},
} as const;

export function clerkLocalization(locale: string) {
	return locale === "es" ? esES : enUS;
}
