import type React from "react"
import "@/app/globals.css"
import {Inter} from "next/font/google"
import {ThemeProvider} from "@/components/theme-provider"
import {Toaster} from "@/components/ui/toaster"
import {AuthKitProvider} from "@workos-inc/authkit-nextjs/components";

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "RMPE PR Review",
  description: "RMPE Team PR Review Tool",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
      <AuthKitProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </AuthKitProvider>
      </body>
    </html>
  )
}

