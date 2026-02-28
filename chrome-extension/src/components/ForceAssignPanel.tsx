import { useState } from "react";
import { Avatar, AvatarFallback } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import type { AssignmentStatus } from "../types";

interface ForceAssignPanelProps {
	reviewers: Array<{
		_id: string;
		name: string;
		email: string;
		assignmentCount: number;
		isAbsent: boolean;
		tags: string[];
	}>;
	tags: Array<{ _id: string; name: string; color: string }>;
	status: AssignmentStatus;
	prUrl: string | null;
	onForceAssign: (reviewerId: string) => void;
}

export function ForceAssignPanel({
	reviewers,
	tags,
	status,
	prUrl,
	onForceAssign,
}: ForceAssignPanelProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");

	const available = reviewers.filter((r) => !r.isAbsent);
	const filtered = search
		? available.filter((r) =>
				r.name.toLowerCase().includes(search.toLowerCase()),
			)
		: available;

	const isAssigning = status === "assigning";
	const canAssign = prUrl && !isAssigning;

	return (
		<div className="mx-4 mt-4 border border-muted p-3 bg-muted/30">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full"
			>
				<svg
					className={`size-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
				</svg>
				Forzar asignación a...
			</button>

			{isOpen && (
				<div className="mt-3 space-y-2">
					<Input
						type="text"
						placeholder="Buscar revisores..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 text-xs"
					/>
					<div className="max-h-[180px] overflow-y-auto border border-border rounded-md">
						{filtered.length === 0 ? (
							<p className="text-xs text-muted-foreground p-3 text-center">
								No se encontraron revisores
							</p>
						) : (
							filtered.map((reviewer) => {
								const reviewerTags = tags.filter((t) =>
									reviewer.tags.includes(t._id),
								);
								return (
									<button
										type="button"
										key={reviewer._id}
										onClick={() => onForceAssign(reviewer._id)}
										disabled={!canAssign}
										className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-b border-border last:border-b-0"
									>
										<Avatar className="size-6">
											<AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
												{reviewer.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<p className="text-xs font-medium text-foreground truncate">
												{reviewer.name}
											</p>
											<div className="flex items-center gap-1 mt-0.5">
												<span className="text-[10px] text-muted-foreground">
													{reviewer.assignmentCount} asignados
												</span>
												{reviewerTags.map((tag) => (
													<Badge
														key={tag._id}
														variant="outline"
														className="text-[9px] px-1 py-0 h-auto border-transparent"
														style={{
															backgroundColor: `${tag.color}20`,
															color: tag.color,
														}}
													>
														{tag.name}
													</Badge>
												))}
											</div>
										</div>
									</button>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
}
