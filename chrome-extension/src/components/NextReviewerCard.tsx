import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import type { AssignmentStatus } from "../types";

interface NextReviewerCardProps {
	reviewer: {
		_id: string;
		name: string;
		email: string;
		assignmentCount: number;
		tags: string[];
	} | null;
	tags: Array<{ _id: string; name: string; color: string }>;
	status: AssignmentStatus;
	lastAssignedName: string | null;
	lastAssignerName: string | null;
	prUrl: string | null;
	onAssign: () => void;
}

export function NextReviewerCard({
	reviewer,
	tags,
	status,
	lastAssignedName,
	lastAssignerName,
	prUrl,
	onAssign,
}: NextReviewerCardProps) {
	if (!reviewer) {
		return (
			<div className="mx-4 mt-4 border-2 border-muted bg-muted p-6 text-center">
				<p className="text-sm text-muted-foreground">
					No hay revisores disponibles
				</p>
			</div>
		);
	}

	const reviewerTags = tags.filter((t) => reviewer.tags.includes(t._id));
	const isAssigning = status === "assigning";
	const isSuccess = status === "success";
	const canAssign = prUrl && !isAssigning;

	return (
		<Card className="mx-4 mt-4 overflow-hidden">
			<CardContent className="p-0">
				{/* Main content area — mirrors AssignmentCard from main app */}
				<div className="text-center py-5 space-y-4">
					{/* Last assigned label */}
					{lastAssignedName && status !== "success" && (
						<div className="space-y-0.5">
							<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
								Último asignado
							</span>
							<p className="text-sm font-medium text-muted-foreground/80">
								{lastAssignedName}
							</p>
						</div>
					)}

					{/* "It's the turn of" badge */}
					<div>
						<span className="inline-flex items-center gap-1.5 bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/25 dark:bg-white/12 dark:text-white dark:ring-white/20">
							<svg
								className="size-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
								/>
							</svg>
							Siguiente revisor
						</span>
					</div>

					{/* Hero gradient card with reviewer name */}
					<div className="relative mx-3 overflow-hidden bg-gradient-to-br from-primary/20 via-primary/16 to-primary/10 p-5 shadow-md ring-1 ring-primary/14 border border-white/6 dark:from-primary/28 dark:via-primary/32 dark:to-primary/20 dark:ring-primary/30 dark:border-white/5">
						<div
							className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.25),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.22),transparent_45%)]"
							aria-hidden
						/>
						<div className="relative space-y-1.5">
							<h3
								className={`text-2xl font-bold text-primary dark:text-white drop-shadow-lg transition-all duration-300 ${isAssigning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}
							>
								{reviewer.name}
							</h3>
							{reviewerTags.length > 0 && (
								<div className="flex justify-center gap-1.5">
									{reviewerTags.map((tag) => (
										<Badge
											key={tag._id}
											variant="secondary"
											className="text-[10px] px-1.5 py-0 h-auto border"
											style={{
												backgroundColor: `${tag.color}20`,
												color: tag.color,
												borderColor: tag.color,
											}}
										>
											{tag.name}
										</Badge>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Assignment count */}
					<p className="text-[10px] text-muted-foreground">
						{reviewer.assignmentCount} asignaciones
					</p>
				</div>

				{/* Assign button — full width like main app */}
				<div className="px-4 pb-4">
					{isSuccess ? (
						<div className="text-center py-2 space-y-0.5">
							<p className="text-xs text-success font-medium">
								✓ Asignado a <strong>{lastAssignedName}</strong>
							</p>
							{lastAssignerName && (
								<p className="text-[10px] text-muted-foreground">
									por {lastAssignerName}
								</p>
							)}
						</div>
					) : (
						<Button
							onClick={onAssign}
							disabled={!canAssign}
							className="w-full h-10 text-sm"
							size="lg"
						>
							{isAssigning ? "Asignando..." : "Asignar PR"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
