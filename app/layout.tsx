import type React from "react";
import "@/app/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { routing } from "@/i18n/routing";

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-display",
});

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider>
			<html
				lang="en"
				suppressHydrationWarning
				className={jetbrainsMono.variable}
			>
				<body className={`${spaceGrotesk.className} antialiased min-h-screen`}>
					<ConvexClientProvider>
						<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
							{children}
							<Toaster />
						</ThemeProvider>
					</ConvexClientProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
