import { useTranslations } from "next-intl";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePRReview } from "../PRReviewContext";
import { HeaderMenu } from "./HeaderMenu";
import { HeaderStatusBar } from "./HeaderStatusBar";

interface PageHeaderProps {
	teamSlug?: string;
}

/**
 * One row: the product, the team, your own status and a menu with everything
 * that is not part of assigning a PR.
 */
export function PageHeader({ teamSlug }: PageHeaderProps) {
	const t = useTranslations();
	const { isForeignTeamView } = usePRReview();

	// Sticky only from lg: on a phone the wrapped header would keep a third of
	// the screen pinned over the assignment card.
	return (
		<header className="relative z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm lg:sticky lg:top-0">
			<div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 lg:px-8 3xl:max-w-7xl 3xl:px-6">
				<div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none">
					<h1 className="shrink-0 text-2xl font-semibold tracking-tight md:text-3xl">
						La Lista
					</h1>
					<span
						aria-hidden="true"
						className="ml-2 shrink-0 text-2xl font-light text-muted-foreground/40 md:text-3xl"
					>
						/
					</span>
					{/* Pulled back by the switcher's own padding, so the slash sits evenly between both names. */}
					<div className="-ml-1.25 min-w-0">
						<TeamSwitcher teamSlug={teamSlug} />
					</div>
				</div>
				<div className="max-sm:order-last max-sm:basis-full">
					<HeaderStatusBar />
				</div>
				<nav
					className="ml-auto flex items-center gap-1"
					aria-label={t("common.options")}
				>
					<ThemeToggle />
					<HeaderMenu />
				</nav>
				{isForeignTeamView ? (
					<p className="basis-full truncate text-xs text-muted-foreground">
						{t("team.foreignTeamReadonlyBanner")}
					</p>
				) : null}
			</div>
		</header>
	);
}
