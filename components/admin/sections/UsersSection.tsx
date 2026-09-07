"use client";

import { useQuery } from "convex/react";
import { Lock, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";

export function UsersSection() {
	const t = useTranslations("admin");
	const users = useQuery(api.adminDirectory.listUsers, {});
	const [filter, setFilter] = useState("");

	if (users === undefined) {
		return (
			<AdminSectionShell
				title={t("users.title")}
				description={t("users.description")}
			>
				<Skeleton className="h-48 w-full" />
			</AdminSectionShell>
		);
	}

	const needle = filter.trim().toLowerCase();
	const visible = needle
		? users.filter(
				(user) =>
					user.email.includes(needle) ||
					(user.name?.toLowerCase().includes(needle) ?? false) ||
					user.memberships.some((membership) =>
						membership.teamSlug.includes(needle),
					),
			)
		: users;

	return (
		<AdminSectionShell
			title={t("users.title")}
			description={t("users.description")}
		>
			<div className="space-y-4">
				<Input
					type="search"
					value={filter}
					placeholder={t("users.filterPlaceholder")}
					onChange={(event) => setFilter(event.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					{t("users.count", { shown: visible.length, total: users.length })}
				</p>
				<ul className="divide-y divide-border/60 rounded-xl border border-border/70">
					{visible.map((user) => (
						<li
							key={user.email}
							className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">
									{user.name ?? user.email}
								</p>
								<p className="truncate font-mono text-xs text-muted-foreground">
									{user.email}
								</p>
							</div>
							{user.isAdmin ? (
								<Badge variant="secondary" className="gap-1">
									{user.adminSource === "env" ? (
										<Lock className="size-3" aria-hidden="true" />
									) : (
										<ShieldCheck className="size-3" aria-hidden="true" />
									)}
									{t("users.admin")}
								</Badge>
							) : null}
							{user.activeAgentTokens > 0 ? (
								<Badge variant="secondary">
									{t("users.agentTokens", { count: user.activeAgentTokens })}
								</Badge>
							) : null}
							{user.memberships.length === 0 ? (
								<Badge variant="secondary">{t("users.noTeams")}</Badge>
							) : (
								<span className="text-xs text-muted-foreground">
									{user.memberships
										.map((membership) =>
											membership.role === "owner"
												? `${membership.teamSlug} (${t("teams.roleOwner")})`
												: membership.teamSlug,
										)
										.join(", ")}
								</span>
							)}
						</li>
					))}
				</ul>
			</div>
		</AdminSectionShell>
	);
}
