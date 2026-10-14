"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { IconActionButton } from "@/components/ui/icon-action-button";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const t = useTranslations("common");
	const isDark = resolvedTheme === "dark";

	return (
		<IconActionButton
			label={t(isDark ? "lightTheme" : "darkTheme")}
			className="relative"
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			<Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
		</IconActionButton>
	);
}
