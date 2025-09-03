"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
	{ code: "en", nameKey: "language.english" },
	{ code: "es", nameKey: "language.spanish" },
];

export function LanguageSwitcher() {
	const locale = useLocale();
	const t = useTranslations();

	const handleLanguageChange = (newLocale: string) => {
		// Use window.location.href for a full page reload to ensure locale changes take effect
		const currentPath = window.location.pathname;
		const newPath = currentPath.replace(/^\/(en|es)/, `/${newLocale}`);
		window.location.href = newPath;
	};

	const currentLanguage = languages.find((lang) => lang.code === locale);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8 px-2">
					<Globe className="h-4 w-4 mr-1" />
					{currentLanguage ? t(currentLanguage.nameKey) : ""}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{languages.map((language) => (
					<DropdownMenuItem
						key={language.code}
						onClick={() => handleLanguageChange(language.code)}
						className={locale === language.code ? "bg-accent" : ""}
					>
						{t(language.nameKey)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
