/**
 * Changelog entries for the application.
 *
 * To add a new entry:
 * 1. Add a new object at the BEGINNING of the array (newest first)
 * 2. Use the format: { date: "YYYY-MM-DD", type: "feature" | "fix" | "improvement", title: "Título", description: "Descripción detallada" }
 * 3. Write in Spanish
 *
 * Example:
 * {
 *   date: "2025-01-15",
 *   type: "feature",
 *   title: "Nueva funcionalidad X",
 *   description: "Agregamos la posibilidad de hacer X, Y y Z.",
 * }
 */

export type ChangelogType = "feature" | "fix" | "improvement";

export interface ChangelogEntry {
	date: string;
	type: ChangelogType;
	title: string;
	description: string;
}

export const changelogTypeLabels: Record<ChangelogType, string> = {
	feature: "Nueva función",
	fix: "Corrección",
	improvement: "Mejora",
};

export const changelogTypeColors: Record<ChangelogType, string> = {
	feature:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
	fix: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
	improvement:
		"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export const changelogEntries: ChangelogEntry[] = [
	// ⬇️ Agrega nuevas entradas aquí (las más recientes primero) ⬇️
	{
		date: "2026-01-21",
		type: "feature",
		title: "Cambio de tema claro/oscuro",
		description:
			"Añadimos un botón en el header para cambiar entre modo claro y oscuro de forma rápida.",
	},
	{
		date: "2026-01-21",
		type: "improvement",
		title: "Mejoras en la tabla de revisores",
		description:
			"Los badges de 'Siguiente' y 'Último Asignado' ahora son más visibles con mejor contraste. Además, cuando un revisor está ausente, ahora se muestra la fecha en que volverá.",
	},
	{
		date: "2026-01-20",
		type: "fix",
		title: "Corrección de Google Chat ID",
		description:
			"Solucionamos un problema donde el ID de Google Chat no se guardaba correctamente al crear un nuevo usuario.",
	},
	{
		date: "2026-01-20",
		type: "improvement",
		title: "Mejoras de visualización",
		description:
			"Optimizamos el layout para evitar que el contenido se corte cuando la UI está con zoom. También limitamos el historial de asignaciones a las últimas 6 entradas para una mejor experiencia.",
	},
	{
		date: "2026-01-19",
		type: "improvement",
		title: "Ajustes de UI",
		description:
			"Actualizamos una de las librerías de UI para mejorar la experiencia visual.",
	},
	{
		date: "2025-12-31",
		type: "feature",
		title: "Gestión de ausencias",
		description:
			"Implementamos una forma de indicar cuando vuelve una persona al marcarse como ausente en la lista. Ahora podrás definir hora y/o fecha de retorno y así la lista te volverá a marcar como disponible sin tener que hacerlo manualmente.",
	},
	{
		date: "2025-12-29",
		type: "feature",
		title: "Creación y gestión de eventos de equipo",
		description:
			"Implementamos una forma de crear eventos de equipo desde la app: gestión de participantes, auto-completado de eventos terminados, mensajes de invitación y notificaciones a Google Chat.",
	},
	// ⬆️ Las entradas más antiguas quedan abajo ⬆️
];
