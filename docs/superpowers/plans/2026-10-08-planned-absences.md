# Planned Absences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any team editor schedule full-day absences (vacations) ahead of time, have them start/end automatically, and see them in a team timeline.

**Architecture:** A `reviewerAbsences` table holds plans. A cron (and an immediate path when the start is today) materializes an absence into the existing `reviewers.isAbsent` / `absentUntil` fields; the existing `processAbsentReturns` handles the return. UI: two-mode `MarkAbsentDialog`, chips on rows/status bar, and a `TeamAbsencesDialog` timeline.

**Tech Stack:** Convex ^1.44, Next.js 16, React, next-intl, shadcn/ui, `@daypicker/react` (via `components/ui/calendar.tsx`), date-fns 4, node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-10-08-planned-absences-design.md`

## Global Constraints

- Read `convex/_generated/ai/guidelines.md` before touching `convex/`. New queries never call `Date.now()`; bounded reads (`take`) only.
- Do not hold `FunctionReference` values in module-level consts inside `convex/` (breaks `api` typing).
- Dates are `"YYYY-MM-DD"` keys in the **team** timezone, resolved with `resolveTeamTimezone(team.timezone)` (default `America/Santiago`). Ranges are inclusive. `returnAt` = 00:00 team-local of the day after `endDate`.
- Permissions: every new mutation calls `assertCanMutateTeamById(ctx, teamId)`; `listTeamAbsences` mirrors `getReviewers` access.
- All user-facing text via next-intl, keys in both `messages/en.json` and `messages/es.json`; Spanish is neutral Latin American, warm tone.
- Do not touch Google Chat cards/templates.
- Use pnpm. Commit only the files of the task (the working tree has unrelated dirty files: `AGENTS.md`, `.claude/`, `.agents/`, `skills-lock.json`, `.cursor/` — never stage them). No `Made-with` trailers; end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Limits: start ≥ today, start ≤ today + 365 days, length ≤ 366 days, no overlap with another `scheduled`/`active` absence of the same reviewer.

## Review Focus

- A reviewer turns their switch back on mid-vacation → the `active` row becomes `completed` and the timeline bar disappears (Task 2 test via helper; manual check in Task 6).
- Range whose start is today → activates immediately, not 5 minutes later (Task 2).
- Team timezone ≠ browser timezone (e.g. team Santiago, browser Madrid) → "today", disabled days and return time are computed in team time (Task 1 tests on `zonedDateKeyToUtcMs` across DST; Task 4 uses team TZ for `todayKey`).
- Reviewer already absent indefinitely when a plan starts → stays indefinite; with a later `absentUntil` → keeps the later one (Task 2 `resolveActivatedAbsentUntil` test).
- Cron missed the whole range (e.g. downtime) → row goes `completed` without marking the person absent (Task 2 same helper test).

---

### Task 1: Pure date/absence logic

**Files:**
- Create: `lib/plannedAbsences.ts`
- Test: `tests/unit/plannedAbsences.test.ts`

**Interfaces:**
- Consumes: `Weekday`, `getLocalDateKeyYYYYMMDD` from `lib/reviewerAvailability.ts`.
- Produces:
  ```ts
  export type DateKey = string;
  export type PlannedAbsenceStatus = "scheduled" | "active" | "completed" | "cancelled";
  export type DateKeyRange = { startDate: DateKey; endDate: DateKey };
  export type AbsenceValidationError =
    | "invalidDate" | "invalidRange" | "startInPast" | "tooFarAhead" | "tooLong" | "overlap";
  export const MAX_ABSENCE_LEAD_DAYS = 365;
  export const MAX_ABSENCE_LENGTH_DAYS = 366;
  export const EARLIEST_TODAY_TIMEZONE = "Pacific/Kiritimati"; // UTC+14
  export const PLANNED_ABSENCE_ERROR_PREFIX = "PlannedAbsenceInvalid:";
  export function isValidDateKey(value: string): boolean;
  export function compareDateKeys(a: DateKey, b: DateKey): number; // <0, 0, >0
  export function addDaysToDateKey(key: DateKey, days: number): DateKey;
  export function diffInDays(from: DateKey, to: DateKey): number; // to - from
  export function dateKeyRangesOverlap(a: DateKeyRange, b: DateKeyRange): boolean;
  export function zonedDateKeyToUtcMs(key: DateKey, timeZone: string): number; // 00:00 local
  export function getAbsenceReturnAt(endDate: DateKey, timeZone: string): number;
  export function getTodayDateKey(now: number, timeZone: string): DateKey;
  export function getWeekdayOfDateKey(key: DateKey): Weekday;
  export function countWeekdaysInRange(range: DateKeyRange): number; // Mon–Fri only
  export function buildTimelineDays(fromKey: DateKey, weekdayCount: number): DateKey[];
  export function absenceCoversDay(range: DateKeyRange, day: DateKey): boolean;
  export function findNextAbsence<T extends DateKeyRange & { reviewerId: string; status: PlannedAbsenceStatus }>(
    absences: readonly T[], reviewerId: string): T | null; // scheduled|active, earliest startDate
  export function validateAbsenceRange(args: {
    range: DateKeyRange; todayKey: DateKey; existing: readonly DateKeyRange[];
  }): AbsenceValidationError | null; // checks in the order of the union above
  export function plannedAbsenceErrorMessage(code: AbsenceValidationError): string; // `${PREFIX}${code}`
  export function parsePlannedAbsenceError(error: unknown): AbsenceValidationError | null;
  ```

- [ ] **Step 1: Write failing tests** in `tests/unit/plannedAbsences.test.ts` (style of `tests/unit/teamRoles.test.ts`). Assertions:
  - `isValidDateKey("2026-10-19") === true`; `"2026-02-30"`, `"2026-1-5"`, `""` → false.
  - `addDaysToDateKey("2026-12-31", 1) === "2027-01-01"`; `addDaysToDateKey("2028-02-28", 1) === "2028-02-29"`; `diffInDays("2026-10-19","2026-10-23") === 4`.
  - `dateKeyRangesOverlap({19..23},{23..25})` true; `({19..23},{24..25})` false.
  - `zonedDateKeyToUtcMs("2026-10-24","America/Santiago") === Date.UTC(2026,9,24,3)` (UTC−3); `zonedDateKeyToUtcMs("2026-03-30","Europe/Madrid") === Date.UTC(2026,2,29,22)` (after DST, UTC+2); `zonedDateKeyToUtcMs("2026-01-10","UTC") === Date.UTC(2026,0,10)`.
  - `getAbsenceReturnAt("2026-10-23","America/Santiago") === Date.UTC(2026,9,24,3)`.
  - `getTodayDateKey(Date.UTC(2026,9,8,2), "America/Santiago") === "2026-10-07"`.
  - `countWeekdaysInRange({"2026-10-19","2026-10-25"}) === 5`.
  - `buildTimelineDays("2026-10-08", 5)` → `["2026-10-08","2026-10-09","2026-10-12","2026-10-13","2026-10-14"]`; from a Saturday `"2026-10-10"` starts at `"2026-10-12"`.
  - `findNextAbsence` ignores `completed`/`cancelled` and other reviewers, returns earliest start.
  - `validateAbsenceRange` with today `"2026-10-08"`: `{"2026-10-07",…}` → `"startInPast"`; end < start → `"invalidRange"`; start `"2027-10-09"` → `"tooFarAhead"`; length 367 days → `"tooLong"`; overlapping existing → `"overlap"`; `{"2026-10-08","2026-10-08"}` → `null`.
  - `parsePlannedAbsenceError(new Error("Uncaught Error: PlannedAbsenceInvalid:overlap\n at ..."))` → `"overlap"`; unrelated error → `null`.
- [ ] **Step 2:** `pnpm run test:unit` → new file fails (module not found).
- [ ] **Step 3: Implement `lib/plannedAbsences.ts`.** Date-key arithmetic via `Date.UTC` on parsed parts (never local `Date`). `zonedDateKeyToUtcMs`: guess = `Date.UTC(y,m-1,d)`; offset = (wall-clock of guess in `timeZone` read with `Intl.DateTimeFormat(...).formatToParts`, as UTC ms) − guess; result = guess − offset; recompute offset at result and correct once more if it differs (DST edge).
- [ ] **Step 4:** `pnpm run test:unit` → all pass.
- [ ] **Step 5: Commit** `feat: add planned absence date helpers`.

### Task 2: Convex backend

**Files:**
- Modify: `convex/schema.ts` (new table, after `reviewers`)
- Create: `convex/absenceLifecycle.ts` (plain helpers, no registered functions)
- Create: `convex/absences.ts` (registered functions)
- Modify: `convex/mutations.ts` (export `createSnapshot`; new exported `returnReviewerToRotation`; use it in `toggleReviewerAbsence` (when becoming available), `markReviewerAvailable`, `processAbsentReturns`; `removeReviewer` deletes absences; `cleanupOldRecords` prunes absences)
- Modify: `convex/crons.ts`, `convex/adminOps.ts` (+ `messages/{en,es}.json` key `…process_planned_absences` next to `process_absent_returns`)
- Modify: `lib/plannedAbsences.ts` + its test (one more pure helper, below)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  ```ts
  // schema: reviewerAbsences { teamId: Id<"teams">, reviewerId: Id<"reviewers">, startDate: string, endDate: string,
  //   status: "scheduled"|"active"|"completed"|"cancelled", createdByEmail?: string, createdAt: number, updatedAt: number }
  //   indexes: by_teamId_and_status, by_reviewerId_and_status, by_status_and_startDate, by_status_and_updatedAt
  // lib/plannedAbsences.ts
  export function resolveActivatedAbsentUntil(args: {
    isAbsent: boolean; absentUntil: number | undefined; returnAt: number; now: number;
  }): { kind: "expired" } | { kind: "activate"; absentUntil: number | undefined };
  // convex/absenceLifecycle.ts
  export async function activateAbsence(ctx: MutationCtx, absence: Doc<"reviewerAbsences">, reviewer: Doc<"reviewers">, timeZone: string, now: number): Promise<"activated" | "expired">;
  export async function completeActiveAbsencesForReviewer(ctx: MutationCtx, reviewerId: Id<"reviewers">, now: number): Promise<number>;
  export async function deleteAbsencesForReviewer(ctx: MutationCtx, reviewerId: Id<"reviewers">): Promise<void>;
  // convex/mutations.ts
  export async function createSnapshot(ctx: MutationCtx, teamId: Id<"teams"> | undefined, description: string): Promise<void>;
  export async function returnReviewerToRotation(ctx: MutationCtx, reviewer: Doc<"reviewers">, now: number): Promise<number>; // returns new assignmentCount
  // convex/absences.ts
  api.absences.scheduleAbsence({ reviewerId, startDate, endDate }) -> { absenceId: Id<"reviewerAbsences">, status: "scheduled" | "active" | "completed" }
  api.absences.updateAbsence({ absenceId, startDate, endDate }) -> { status }
  api.absences.cancelAbsence({ absenceId }) -> { status: "cancelled" | "completed" }
  api.absences.listTeamAbsences({ teamSlug }) -> Doc<"reviewerAbsences">[]   // scheduled + active, ≤200
  internal.absences.processPlannedAbsences({}) -> { activated: number; expired: number }
  ```

- [ ] **Step 1: Failing test** for `resolveActivatedAbsentUntil` in `tests/unit/plannedAbsences.test.ts`: `returnAt <= now` → `{kind:"expired"}`; not absent → `{activate, absentUntil: returnAt}`; absent with `absentUntil: undefined` → `{activate, absentUntil: undefined}`; absent until later than returnAt → keeps later; absent until earlier → `returnAt`. Run, see fail, implement, see pass.
- [ ] **Step 2: Schema** — add the table and the four indexes exactly as above.
- [ ] **Step 3: `absenceLifecycle.ts`.** `activateAbsence`: use `resolveActivatedAbsentUntil`; on `expired` patch row `status:"completed"`; on `activate` patch reviewer `{isAbsent:true, absentUntil}` and row `status:"active"`. Always set `updatedAt: now`. No snapshot here (callers snapshot). `completeActiveAbsencesForReviewer` uses `by_reviewerId_and_status` `eq("active")`, `take(20)`.
- [ ] **Step 4: `mutations.ts`.** Extract the body shared by `markReviewerAvailable`/`processAbsentReturns` (team reviewers → eligible filter → `getMostCommonAssignmentCount` → patch `{isAbsent:false, absentUntil:undefined, assignmentCount}`) into `returnReviewerToRotation`, which also calls `completeActiveAbsencesForReviewer`. Keep each caller's existing snapshot text. `toggleReviewerAbsence` becoming-available path uses it too. `removeReviewer` calls `deleteAbsencesForReviewer` before deleting. `cleanupOldRecords`: for `completed` and `cancelled`, `by_status_and_updatedAt` `lt(cutoffTimestamp)`, `take(CLEANUP_BATCH_SIZE)`, delete.
- [ ] **Step 5: `absences.ts`.** Each mutation: load reviewer/team, `assertCanMutateTeamById`, `todayKey = getTodayDateKey(Date.now(), tz)`, existing = reviewer's `scheduled`+`active` rows (minus self on update), `validateAbsenceRange` → on error `throw new Error(plannedAbsenceErrorMessage(code))`. `createdByEmail` from `ctx.auth.getUserIdentity()`. If `startDate <= todayKey` after insert/update, call `activateAbsence`. Snapshot texts: `Planned absence for ${name} (${start} → ${end})`, `Updated planned absence…`, `Cancelled planned absence…`, `Planned absence started for…`. `updateAbsence` on `active`: reject if `startDate` changed (`invalidRange`), validate `endDate >= todayKey`, patch row, and if reviewer `isAbsent && absentUntil !== undefined` set `absentUntil = getAbsenceReturnAt(endDate, tz)`. `cancelAbsence`: scheduled → `cancelled`; active → `returnReviewerToRotation` (marks it `completed`). Rows in `completed`/`cancelled` → throw `"Absence is no longer editable"`. `processPlannedAbsences`: `by_status_and_startDate` `eq("scheduled").lte("startDate", getTodayDateKey(now, EARLIEST_TODAY_TIMEZONE))`, `take(100)`; per row compare with the team's own today; activate; snapshot per activation.
- [ ] **Step 6: Cron + admin ops.** `crons.interval("process-planned-absences", { minutes: 5 }, internal.absences.processPlannedAbsences)`. In `adminOps.ts` add `{ key: "process_planned_absences", destructive: false }` and its `case` (resolve ref inside the switch, like the others). Add the description key in both message files beside `process_absent_returns` (es: "Activa las ausencias planificadas cuando llega su fecha de inicio.").
- [ ] **Step 7: Verify.** `pnpm exec convex codegen` (or `pnpm exec convex dev --once` against the **dev** deployment) succeeds; `pnpm exec tsc --noEmit -p .` clean; `pnpm run test:unit` pass; `pnpm run lint` clean.
- [ ] **Step 8: Commit** `feat: schedule reviewer absences in advance (backend)`.

### Task 3: Client data layer + copy

**Files:**
- Modify: `hooks/useConvexPRReviewData.ts`, `components/pr-review/PRReviewContext.tsx`, `components/pr-review/PRReviewAssignment.tsx` (wires the provider value)
- Modify: `messages/en.json`, `messages/es.json` (all keys for Tasks 4–5)

**Interfaces:**
- Consumes: Task 2 API, `parsePlannedAbsenceError`.
- Produces on `PRReviewContextValue`:
  ```ts
  plannedAbsences: Doc<"reviewerAbsences">[];   // [] while loading
  teamTimezone: string;                          // resolveTeamTimezone(team?.timezone)
  onScheduleAbsence: (reviewerId: Id<"reviewers">, range: DateKeyRange) => Promise<boolean>;
  onUpdateAbsence: (absenceId: Id<"reviewerAbsences">, range: DateKeyRange) => Promise<boolean>;
  onCancelAbsence: (absenceId: Id<"reviewerAbsences">) => Promise<boolean>;
  ```
  Handlers toast success; on error toast `absent.plan.errors.<code>` when `parsePlannedAbsenceError` matches, else the existing generic error pattern; return `false`.
- i18n keys (both locales), under `absent`: `modeNow`, `modePlan`, `planSubmit`, `planSaved`, `planUpdated`, `planCancelled`, `planEnded`, `planPreview` ("Fuera del {start} al {end} ({days, plural, …} hábiles)"), `planReturn` ("Vuelves a la rotación el {date} a las 00:00 ({timeZone})" / other-person variant `planReturnOther`), `editTitle`, `cancelPlan`, `endNow`, `chipShort` ("{range}"), `chipVacation` ("Vacaciones {range}"), `planCta` ("Planificar…"), `plan.errors.{invalidDate,invalidRange,startInPast,tooFarAhead,tooLong,overlap}`; namespace `absenceTimeline`: `open`, `title`, `description`, `previous`, `next`, `rangeLabel`, `available`, `legendNow`, `legendPlanned`, `legendPartTime`, `legendLow`, `barLabel` ("{name}, ausente del {start} al {end}"), `cellLabel` ("Planificar ausencia de {name} el {date}"), `empty`.

- [ ] **Step 1:** Add the query (`teamSlug ? {teamSlug} : "skip"`), mutations, handlers, and context fields; wire them in `PRReviewAssignment.tsx`.
- [ ] **Step 2:** Add all message keys in both files (same key set; run `node -e` diff of key paths between en/es → no differences).
- [ ] **Step 3: Verify** `pnpm exec tsc --noEmit -p .` and `pnpm run lint` clean.
- [ ] **Step 4: Commit** `feat: expose planned absences to the review UI`.

### Task 4: Dialog modes + chips

**Files:**
- Modify: `components/pr-review/dialogs/MarkAbsentDialog.tsx`
- Create: `components/pr-review/PlannedAbsenceChip.tsx` (chip + popover with Edit / Cancel)
- Modify: `components/pr-review/ReviewersTable.tsx`, `components/pr-review/header/HeaderStatusBar.tsx`

**Interfaces:**
- Consumes: Task 3 context fields, Task 1 helpers.
- Produces:
  ```ts
  // MarkAbsentDialog props (existing ones kept)
  initialMode?: "now" | "plan";              // default "now"
  initialRange?: DateKeyRange;
  absence?: Doc<"reviewerAbsences">;         // edit mode when set
  // PlannedAbsenceChip
  export function PlannedAbsenceChip(props: { absence: Doc<"reviewerAbsences">; reviewer: Reviewer;
    variant: "short" | "vacation"; canEdit: boolean }): JSX.Element;
  export function formatDateKeyRange(range: DateKeyRange, locale: string): string; // "19–23 oct", "28 oct – 3 nov"
  ```
- [ ] **Step 1:** Dialog: segmented control (existing `ToggleGroup` or `Tabs`) hidden in edit mode; plan mode renders `Calendar mode="range"` with `disabled` = days before `getTodayDateKey(now, teamTimezone)` and days covered by the reviewer's other scheduled/active absences; preview uses `countWeekdaysInRange` and `getAbsenceReturnAt`, showing the team timezone only when it differs from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Submit disabled while `validateAbsenceRange` returns non-null; inline message from `absent.plan.errors.*`. Convert calendar `Date`s to keys with `date-fns` `format(d, "yyyy-MM-dd")` (calendar dates are browser-local calendar days, which is what the user clicked). Edit mode: title `editTitle`, footer has `cancelPlan` (scheduled) or `endNow` (active) plus Save; active rows lock the start date.
- [ ] **Step 2:** `PlannedAbsenceChip`: amber pill (`bg-amber-500/15 text-amber-800 dark:text-amber-300`) with lucide `Plane`; with `canEdit` it's a button opening a `Popover` (dates, weekday count, Edit → dialog in edit mode, Cancel/End now → `onCancelAbsence`); without, plain span with tooltip.
- [ ] **Step 3:** `ReviewersTable`: render the chip for `findNextAbsence(plannedAbsences, reviewer._id)` when it is `scheduled`, in the meta line; replace `team?.timezone ?? "UTC"` with context `teamTimezone`. `HeaderStatusBar`: chip (`vacation` variant) for the current reviewer's next scheduled absence + `planCta` ghost button (when `canToggleAvailability`) opening the dialog with `initialMode="plan"`.
- [ ] **Step 4: Verify** tsc + lint clean.
- [ ] **Step 5: Commit** `feat: plan absences from the absence dialog`.

### Task 5: Team timeline

**Files:**
- Create: `components/pr-review/dialogs/TeamAbsencesDialog.tsx`
- Modify: `components/pr-review/ReviewersPanel.tsx` (CalendarDays `IconActionButton` in the open header for everyone; when collapsed nothing new)

**Interfaces:**
- Consumes: Task 3 context, Task 1 helpers, Task 4 `MarkAbsentDialog` props and `formatDateKeyRange`.
- Produces: `export function TeamAbsencesDialog(props: { trigger: React.ReactNode }): JSX.Element`.
- [ ] **Step 1:** Dialog `sm:max-w-4xl`. State `windowStart` (DateKey, initial = today in team TZ); days = `buildTimelineDays(windowStart, 15)`; prev/next shift by 21 calendar days, prev disabled when it would start before the Monday of the current week. Grid: `grid-template-columns: minmax(7rem,9rem) repeat(15, minmax(2.25rem,1fr))` inside `overflow-x-auto`, name column `sticky left-0 bg-card`. Rows = `reviewers` (same order as the table); out-of-pool rows dimmed.
- [ ] **Step 2:** Cells per reviewer/day: planned bar if a `scheduled`/`active` absence covers the day (amber; start/end rounded); "now" bar (primary) for days from today until `getTodayDateKey(absentUntil - 1, tz)` when `manualIsAbsent` (to window end with fade when `absentUntil` undefined); part-time off pattern when the weekday isn't in `partTimeSchedule.workingDays`. With `canManageCurrentTeam`: bar → `MarkAbsentDialog` with `absence`; empty cell → `MarkAbsentDialog` `initialMode="plan"` `initialRange={start: day, end: day}`. `aria-label` from `absenceTimeline.barLabel` / `cellLabel`.
- [ ] **Step 3:** "Disponibles" row: per day, count reviewers with `excludedFromReviewPool !== true` that are not covered by any bar and not part-time off; red when `count <= Math.floor(pool * 0.6)`. Legend below.
- [ ] **Step 4: Verify** tsc + lint clean.
- [ ] **Step 5: Commit** `feat: team absence timeline`.

### Task 6: Verification and review

- [ ] **Step 1:** `pnpm run test:unit`, `pnpm exec tsc --noEmit -p .`, `pnpm run lint`, `pnpm run build` — all clean.
- [ ] **Step 2:** Run the app (dev Convex deployment) and check in the browser: plan 19–23 oct for self → chip in status bar and row; timeline shows bar and counts; edit dates; cancel; plan starting today → switch turns off immediately; turn switch on → bar disappears; end-now on active.
- [ ] **Step 3:** Code review of the branch with Sol 6.1; evaluate each comment (superpowers:receiving-code-review) and fix the valid ones; re-run Step 1.
