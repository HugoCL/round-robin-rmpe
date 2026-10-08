# Ausencias planificadas — diseño

Fecha: 2026-10-08 · Estado: aprobado en conversación, pendiente revisión del spec

## Objetivo

Un usuario pidió poder **planificar ausencias futuras** (vacaciones, días libres)
para dejarlas agendadas y olvidarse. Hoy solo se puede marcar a alguien ausente
*desde ahora*, con un regreso opcional.

Criterios de éxito:

- Cualquier persona que hoy puede editar el equipo puede planificar un rango de
  días completos para cualquier revisor (mismos permisos que el switch actual).
- El revisor sale de la rotación automáticamente al empezar el rango y vuelve al
  terminar, con el mismo rebalanceo de `assignmentCount` que existe hoy.
- El equipo ve en una línea de tiempo quién falta las próximas semanas y cuándo
  se juntan ausencias.

Fuera de alcance: tool de MCP/agent, avisos en Google Chat (las cards no se
tocan), push notifications, ausencias por horas, historial de ausencias pasadas.

## Enfoque

Una tabla de **planes** (`reviewerAbsences`) que un cron **materializa** en los
campos existentes `reviewers.isAbsent` / `absentUntil`. Todo lo que hoy lee
esos campos (asignación, snapshots, agent, backups) sigue igual, y el regreso
lo sigue haciendo `processAbsentReturns`.

Se descartó calcular la ausencia al leer: obliga a cargar ausencias en cada
camino de asignación y pierde el rebalanceo del contador al volver.

## Modelo de datos

```ts
reviewerAbsences: defineTable({
  teamId: v.id("teams"),
  reviewerId: v.id("reviewers"),
  startDate: v.string(), // "YYYY-MM-DD" en zona horaria del equipo, inclusivo
  endDate: v.string(),   // "YYYY-MM-DD" inclusivo
  status: v.union(
    v.literal("scheduled"),
    v.literal("active"),
    v.literal("completed"),
    v.literal("cancelled"),
  ),
  createdByEmail: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_teamId_and_status", ["teamId", "status"])
  .index("by_reviewerId_and_status", ["reviewerId", "status"])
  .index("by_status_and_startDate", ["status", "startDate"])
  .index("by_status_and_updatedAt", ["status", "updatedAt"])
```

Fechas como claves `YYYY-MM-DD` en la zona del equipo (`resolveTeamTimezone`),
igual que los cumpleaños. No hay librería de zonas horarias en el proyecto; el
único cálculo con zona es "00:00 local de una fecha → ms UTC", que se resuelve
con `Intl` en un helper puro.

**Hora de regreso** de una ausencia = 00:00 (hora del equipo) del día siguiente
a `endDate`. Se llama `returnAt` abajo.

## Ciclo de vida

```
scheduled ──(llega startDate)──▶ active ──(regreso)──▶ completed
    │                              │
    └──(cancelar)──▶ cancelled     └──(terminar ahora / vuelve antes)──▶ completed
```

**Activación** (helper compartido `activateAbsence`):

- Si `returnAt <= now` (el rango ya pasó entero, p. ej. cron caído): marcar
  `completed` sin tocar al reviewer.
- Si el reviewer ya está ausente sin fecha (`absentUntil` indefinido): se
  respeta, no se acorta. Si tiene fecha: `absentUntil = max(actual, returnAt)`.
- Si no está ausente: `isAbsent: true, absentUntil: returnAt`.
- `status: "active"` y snapshot "Planned absence started for X (inicio–fin)".

**Cron** `processPlannedAbsences` (internalMutation, cada 5 min, en
`convex/crons.ts` junto a `process-absent-returns`): lee `scheduled` con
`startDate <= hoy` en la zona más adelantada del mundo (UTC+14) vía
`by_status_and_startDate`, y por cada fila compara con el "hoy" de la zona del
equipo antes de activar. Lote acotado (`take(100)`).

**Regreso**: `processAbsentReturns`, `markReviewerAvailable` y
`toggleReviewerAbsence` (cuando pasa a disponible) marcan `completed` toda fila
`active` del reviewer. Sin esto el siguiente tick del cron no la reactivaría
(ya no está `scheduled`), pero quedaría colgada como `active` en la vista.

**Borrar reviewer**: se borran sus filas de `reviewerAbsences`.

**Limpieza**: `cleanupOldRecords` borra filas `completed`/`cancelled` con
`updatedAt` anterior al corte de retención, en lotes de 200.

**Snapshots/restore**: no incluyen la tabla nueva. Restaurar un snapshot no
toca las ausencias planificadas.

## API Convex (`convex/absences.ts`)

Todas las mutations usan `assertCanMutateTeamById` (mismo permiso que el switch).

- `scheduleAbsence({ reviewerId, startDate, endDate })`
  - Valida formato, `startDate <= endDate`, `startDate >= hoy` (zona del equipo),
    `startDate <= hoy + 365 días`, duración ≤ 366 días.
  - Rechaza si se solapa con otra fila `scheduled`/`active` del mismo reviewer.
  - Si `startDate == hoy`, activa en la misma mutation (sin esperar al cron).
- `updateAbsence({ absenceId, startDate, endDate })`
  - `scheduled`: mismas validaciones que crear (excluyendo la propia fila del
    chequeo de solape); si el nuevo inicio es hoy, activa.
  - `active`: solo cambia `endDate` (debe ser ≥ hoy); actualiza `absentUntil`
    del reviewer al nuevo `returnAt` si su ausencia tiene fecha.
- `cancelAbsence({ absenceId })`
  - `scheduled` → `cancelled`.
  - `active` → "terminar ahora": `completed` y el reviewer vuelve disponible con
    la misma lógica de `markReviewerAvailable` (rebalanceo incluido). La lógica
    de regreso se extrae a un helper para no duplicarla.
- `listTeamAbsences({ teamSlug })` (query): filas `scheduled` y `active` del
  equipo, acotado a 200. Mismo acceso que `getReviewers`. No lee el reloj; el
  cliente decide qué ventana mostrar.

Errores de validación se lanzan con mensajes que el cliente traduce vía
`lib/convexErrors.ts` (claves nuevas para solape, fecha pasada, rango inválido).

## Lógica pura (`lib/plannedAbsences.ts`)

Funciones sin dependencias de Convex, usadas por backend y frontend:

- `isValidDateKey`, `compareDateKeys`, `addDaysToDateKey`, `diffInDays`
- `dateKeyRangesOverlap(a, b)`
- `zonedDateKeyToUtcMs(dateKey, timeZone)` — 00:00 local → ms UTC (DST-safe)
- `getAbsenceReturnAt(endDate, timeZone)`
- `countWeekdaysInRange(start, end)` — para "5 días hábiles"
- `buildTimelineDays(fromDateKey, weekdayCount)` — días hábiles de la grilla
- `findNextAbsence(absences, reviewerId)` — la próxima `scheduled` (o `active`)

Tests en `tests/unit/plannedAbsences.test.ts` (node:test, como el resto).

## UI

### 1. `MarkAbsentDialog` con dos modos

Control segmentado arriba: **Desde ahora** | **Planificar fechas**.

- *Desde ahora*: comportamiento actual intacto.
- *Planificar fechas*: `Calendar mode="range"`, días pasados y días ya cubiertos
  por otra ausencia del mismo reviewer deshabilitados. Vista previa:
  "Fuera del lun 19 al vie 23 oct (5 días hábiles). Vuelves a la rotación el
  sáb 24 oct a las 00:00 (hora de Santiago)". La zona se muestra solo si difiere
  de la del navegador. Botón "Planificar ausencia".
- Props nuevas: `initialMode`, `initialRange`, y `absence` para editar
  (título "Editar ausencia", botones "Guardar" y "Cancelar ausencia" /
  "Terminar ahora" si está activa).
- Al apagar el switch se abre en *Desde ahora*; desde "Planificar…" o desde la
  línea de tiempo, en *Planificar fechas*.

### 2. Indicadores

- `ReviewersTable`: chip ámbar con ícono `Plane` y rango corto ("19–23 oct")
  en la línea de meta, para la próxima ausencia `scheduled`. Con permiso de
  edición, clic → popover con detalle + Editar / Cancelar.
- `HeaderStatusBar`: mismo chip ("Vacaciones 19–23 oct") y un botón
  "Planificar…" cuando `canToggleAvailability`.

Planificar para *otra* persona se hace desde la línea de tiempo (clic en celda
vacía) o desde el switch. No se agrega un menú nuevo por fila: la fila ya tiene
switch, contador y editar, y otro ícono la satura.

### 3. Línea de tiempo del equipo (`TeamAbsencesDialog`)

Se abre desde un ícono `CalendarDays` nuevo en la cabecera de `ReviewersPanel`
(visible para todos; acciones de edición solo con `canManageCurrentTeam`).

- Grilla: columna fija de nombres + 15 días hábiles desde hoy (zona del equipo),
  separadores por semana, hoy destacado. Flechas para avanzar/retroceder de a
  3 semanas sin ir antes de la semana actual.
- Barras: ámbar = planificada; color primario = ausente ahora (derivada de
  `isAbsent`/`absentUntil` del reviewer; si es indefinida llega hasta el borde
  con un degradado). Días libres por jornada parcial con trama tenue.
- Fila "Disponibles": por día, revisores del pool general que no están ausentes
  ni libres por jornada parcial. En rojo si ≤ 60% del pool.
- Clic en barra planificada → `MarkAbsentDialog` en modo edición. Clic en celda
  vacía → `MarkAbsentDialog` en *Planificar fechas* con ese día preseleccionado.
- Móvil: scroll horizontal con la columna de nombres `sticky`.
- Teclado: barras y celdas accionables son botones con `aria-label`
  ("Hugo Castro, ausente del 19 al 23 de octubre").

### i18n

Claves nuevas en `messages/en.json` y `messages/es.json` (namespace `absent`
para el diálogo/chips y `absenceTimeline` para la vista). Microcopy cálida,
español neutro.

## Datos en el cliente

`useConvexPRReviewData` suma `useQuery(api.absences.listTeamAbsences)` y expone
`plannedAbsences` + handlers `scheduleAbsence` / `updateAbsence` /
`cancelAbsence` vía `PRReviewContext`, con toasts como los existentes.

## Verificación

- Unit tests de `lib/plannedAbsences.ts` (incluye DST y fin de año).
- `pnpm run lint`, typecheck y build.
- Prueba manual en el dev server: planificar, ver chip y timeline, editar,
  cancelar, activación inmediata cuando el inicio es hoy, "terminar ahora", y
  que encender el switch durante una ausencia activa la marque `completed`.
