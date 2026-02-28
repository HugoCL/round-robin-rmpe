import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "la-lista-selected-team";

/**
 * Persists the selected team slug in chrome.storage.local.
 * Supports auto-detection: if userTeamSlugs has exactly one match
 * and no team was previously saved, it auto-selects that team.
 */
export function useTeamStorage(userTeamSlugs?: string[]) {
	const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);
	const autoDetected = useRef(false);

	useEffect(() => {
		chrome.storage.local.get(STORAGE_KEY, (result) => {
			if (result[STORAGE_KEY]) {
				setSelectedTeam(result[STORAGE_KEY]);
			}
			setLoaded(true);
		});
	}, []);

	// Auto-detect team when user belongs to exactly one team and none is selected
	useEffect(() => {
		if (
			loaded &&
			!selectedTeam &&
			!autoDetected.current &&
			userTeamSlugs &&
			userTeamSlugs.length === 1
		) {
			autoDetected.current = true;
			const slug = userTeamSlugs[0];
			setSelectedTeam(slug);
			chrome.storage.local.set({ [STORAGE_KEY]: slug });
		}
	}, [loaded, selectedTeam, userTeamSlugs]);

	const saveTeam = (teamSlug: string) => {
		setSelectedTeam(teamSlug);
		chrome.storage.local.set({ [STORAGE_KEY]: teamSlug });
	};

	return { selectedTeam, saveTeam, loaded };
}
