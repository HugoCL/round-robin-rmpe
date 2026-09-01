"use client";

import CreateTeamForm from "@/components/CreateTeamForm";
import { SecondaryPageNav } from "@/components/SecondaryPageNav";

export default function CreateTeamPage() {
	return (
		<>
			<SecondaryPageNav />
			<div className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_60%)]"
				/>
				<div className="page-enter-soft relative flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4 py-10">
					<CreateTeamForm />
				</div>
			</div>
		</>
	);
}
