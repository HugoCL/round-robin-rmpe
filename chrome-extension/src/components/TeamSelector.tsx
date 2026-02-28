interface TeamSelectorProps {
	teams: Array<{ _id: string; name: string; slug: string }>;
	selectedTeam: string | null;
	onSelect: (slug: string) => void;
	highlightSlugs?: string[];
}

export function TeamSelector({
	teams,
	selectedTeam,
	onSelect,
	highlightSlugs = [],
}: TeamSelectorProps) {
	if (teams.length === 0) {
		return (
			<div className="px-4 py-3 text-xs text-muted-foreground">
				No hay equipos disponibles
			</div>
		);
	}

	return (
		<div className="px-4 py-3 border-b border-border">
			<select
				value={selectedTeam ?? ""}
				onChange={(e) => onSelect(e.target.value)}
				className="w-full text-sm px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
			>
				<option value="" disabled>
					Selecciona un equipo...
				</option>
				{teams.map((team) => (
					<option key={team._id} value={team.slug}>
						{team.name}
						{highlightSlugs.includes(team.slug) ? " ★" : ""}
					</option>
				))}
			</select>
		</div>
	);
}
