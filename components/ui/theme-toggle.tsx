"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const t = useTranslations();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
						aria-label={t("common.theme")}
					>
						<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
						<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{t("common.theme")}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
