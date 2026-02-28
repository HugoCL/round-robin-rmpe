import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";

interface TagFilterProps {
	tags: Array<{ _id: string; name: string; color: string }>;
	selectedTagId: string | null;
	onSelect: (tagId: string | null) => void;
}

export function TagFilter({ tags, selectedTagId, onSelect }: TagFilterProps) {
	if (tags.length === 0) return null;

	return (
		<div className="mx-4 mt-3">
			<label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
				Filtrar por etiqueta
			</label>
			<div className="flex flex-wrap gap-1.5">
				<Badge
					variant={selectedTagId === null ? "default" : "outline"}
					className={cn(
						"cursor-pointer text-[11px] px-2.5 py-1 hover:opacity-80 transition-opacity",
						selectedTagId === null && "bg-primary text-primary-foreground",
					)}
					onClick={() => onSelect(null)}
				>
					Todos
				</Badge>
				{tags.map((tag) => {
					const isSelected = selectedTagId === tag._id;
					return (
						<Badge
							key={tag._id}
							variant="outline"
							className={cn(
								"cursor-pointer text-[11px] px-2.5 py-1 hover:opacity-80 transition-opacity",
								isSelected && "text-white border-transparent",
								!isSelected && "hover:bg-muted",
							)}
							style={
								isSelected
									? { backgroundColor: tag.color, borderColor: tag.color }
									: { color: tag.color }
							}
							onClick={() => onSelect(isSelected ? null : tag._id)}
						>
							{tag.name}
						</Badge>
					);
				})}
			</div>
		</div>
	);
}
