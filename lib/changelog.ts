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
		date: "2026-02-19",
		type: "feature",
		title: "Tablero de sugerencias",
		description:
			"Agregamos un tablero de sugerencias tipo feedback board: ahora puedes crear ideas, dar upvotes y comentar. También incorporamos un acceso rápido por ícono en el header (junto a novedades, el ícono de la ampolleta) para entrar al tablero.",
	},
	{
		date: "2026-02-16",
		type: "feature",
		title: "Mis ajustes persistentes por usuario",
		description:
			"Separamos 'Mis ajustes' de los ajustes del equipo y ahora las preferencias personales se guardan en base de datos por usuario. Incluye visibilidad de columnas, ocultar asignación múltiple y forzar el envío de mensajes a Google Chat, aplicando también en asignación normal, forzada y atajos.",
	},
	{
		date: "2026-02-16",
		type: "feature",
		title: "Asignación múltiple configurable por PR",
		description:
			"Ahora puedes activar la asignación múltiple desde la tarjeta principal y definir más de un revisor por PR (incluyendo selección manual o por tags). También unificamos la UI de opciones con tooltips y mejoramos la claridad de estados y previsualización por slot.",
	},
	{
		date: "2026-02-16",
		type: "fix",
		title: "Auto-skip consistente en asignaciones por tags",
		description:
			"Homologamos la lógica entre asignación regular y por tags: si te toca a ti como siguiente, ahora se te omite y se asigna al próximo revisor disponible del mismo tag. Además, la tarjeta de asignación ahora muestra el aviso y el 'Siguiente' también en modo tags.",
	},
	{
		date: "2026-02-15",
		type: "improvement",
		title: "Cambios menores a la vista de revisores",
		description:
			"Movimos las opciones de columnas a la vista de revisores, y eliminamos el botón de Actualizar que ya no es necesario (La Lista se actualiza en tiempo real).",
	},
	{
		date: "2026-02-12",
		type: "improvement",
		title: "Mejora en la visualización de eventos próximos",
		description:
			"Ahora es más fácil saber cuando hay un evento próximo, ya que movimos la sección de próximos eventos al header y mejoramos un poco el diseño.",
	},
	{
		date: "2026-02-13",
		type: "improvement",
		title: "Nueva landing de equipos",
		description:
			"Rediseñamos la pantalla inicial para reemplazar la redirección automática por un selector de equipos.",
	},
	{
		date: "2026-02-13",
		type: "improvement",
		title: "Vista compacta como experiencia única",
		description:
			"La Vista Compacta ahora es la única disponible en La Lista. Eliminamos la Vista Clásica y el aviso de deprecación para simplificar la experiencia y reducir complejidad en la interfaz.",
	},
	{
		date: "2026-02-12",
		type: "improvement",
		title: "Asignación por tags integrada en la tarjeta principal",
		description:
			"Unificamos la experiencia de asignación para evitar el flujo separado en popup. Ahora puedes elegir el modo regular o por tags directamente en la sección de asignación de PRs.",
	},
	{
		date: "2026-02-02",
		type: "feature",
		title: "Detección de PRs duplicados",
		description:
			"Ahora cuando ingresas una URL de PR en la asignación, el sistema verifica automáticamente si ese PR ya fue asignado anteriormente. Si detecta un duplicado, muestra una alerta indicando a quién fue asignado y cuándo, evitando asignaciones duplicadas accidentales.",
	},
	{
		date: "2026-01-26",
		type: "fix",
		title: "El creador del evento ahora aparece como participante",
		description:
			"Al crear un evento, el usuario que lo crea se añade automáticamente a la lista de participantes. Esto corrige un comportamiento en el que el creador no figuraba como asistente por defecto y asegura que contadores y notificaciones reflejen correctamente al organizador.",
	},
	{
		date: "2026-01-24",
		type: "feature",
		title: "Notificaciones push y PWA",
		description:
			"La Lista ahora es una PWA instalable. Puedes activar notificaciones push para recibir alertas cuando te asignen un PR o cuando comience un evento en el que participas, para esos casos que no tienes Google Chat abierto o tienes el modo no molestar activado.",
	},
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
