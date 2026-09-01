import type { Metadata, Viewport } from "next";
import type React from "react";
import "@/app/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { getLocale } from "next-intl/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { routing } from "@/i18n/routing";
import { clerkLocalization } from "@/lib/clerkAppearance";

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
		{ media: "(prefers-color-scheme: dark)", color: "#17181d" },
	],
	width: "device-width",
	initialScale: 1,
};

export const metadata: Metadata = {
	manifest: "/manifest.webmanifest",
	icons: {
		apple: "/icon-192x192.png",
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "La Lista",
	},
};

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-display",
});

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// The locale comes from the next-intl middleware, so `<html lang>` follows the
	// URL instead of always claiming English.
	const locale = await getLocale();

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
		>
			<body className="min-h-screen antialiased">
				<ClerkProvider localization={clerkLocalization(locale)}>
					<ConvexClientProvider>
						<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
							{children}
							<Toaster />
						</ThemeProvider>
					</ConvexClientProvider>
				</ClerkProvider>
			</body>
		</html>
	);
}
