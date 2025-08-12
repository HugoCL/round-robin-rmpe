"use client";

import CreateTeamForm from "@/components/CreateTeamForm";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function CreateTeamPage() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div className="min-h-[100vh] flex flex-col">
      <div className="absolute top-4 left-4">
        <Link href={`/${locale}`} className="text-sm underline hover:no-underline text-muted-foreground">
          {t("team.backHome")}
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <CreateTeamForm />
      </div>
    </div>
  );
}
