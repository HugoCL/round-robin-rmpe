import type React from "react";
import "@/app/globals.css";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { unstable_ViewTransition as ViewTransition } from "react";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
	title: "RMPE PR Review",
	description: "RMPE Team PR Review Tool",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ViewTransition>
			<html lang="en" suppressHydrationWarning>
				<body className={inter.className}>
					<AuthKitProvider>
						<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
							{children}
							<Toaster />
						</ThemeProvider>
					</AuthKitProvider>
				</body>
			</html>
		</ViewTransition>
	);
}
