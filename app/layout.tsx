import type React from "react";
import "@/app/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { routing } from "@/i18n/routing";

const inter = Inter({ subsets: ["latin"] });

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
			<html lang="en" suppressHydrationWarning>
				<body className={inter.className}>
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
