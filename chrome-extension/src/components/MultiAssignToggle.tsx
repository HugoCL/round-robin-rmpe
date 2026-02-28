import { Switch } from "@/ui/switch";
import type { AssignmentMode } from "../types";

interface MultiAssignToggleProps {
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
	mode: AssignmentMode;
	onModeChange: (mode: AssignmentMode) => void;
	hasTags: boolean;
}

export function MultiAssignToggle({
	enabled,
	onToggle,
	mode,
	onModeChange,
	hasTags,
}: MultiAssignToggleProps) {
	return (
		<div className="mx-4 mt-3 border border-muted p-3 bg-muted/30 space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<svg
						className="size-3.5 text-primary"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
						/>
					</svg>
					<span className="text-[11px] font-medium text-foreground">
						Múltiples revisores
					</span>
				</div>
				<Switch checked={enabled} onCheckedChange={onToggle} />
			</div>

			{/* Mode switcher: Regular vs With Tags */}
			{enabled && hasTags && (
				<div className="flex gap-1 p-0.5 rounded-md bg-muted/60 border border-border">
					<button
						type="button"
						onClick={() => onModeChange("regular")}
						className={`flex-1 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
							mode === "regular"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Normal
					</button>
					<button
						type="button"
						onClick={() => onModeChange("tag")}
						className={`flex-1 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
							mode === "tag"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Con etiquetas
					</button>
				</div>
			)}
		</div>
	);
}
