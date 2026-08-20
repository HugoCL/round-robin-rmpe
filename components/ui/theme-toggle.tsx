"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { IconActionButton } from "@/components/ui/icon-action-button";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const t = useTranslations();

	return (
		<IconActionButton
			label={t("common.theme")}
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
		>
			<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
		</IconActionButton>
	);
}
