# Plan: Cumulative Flow Diagram (CFD) Panel on Dashboard

## Goal
Add a Cumulative Flow Diagram panel to the dashboard showing, per day over the
selected period, the cumulative number of Task/Bug tickets in three states:

- **Backlog** — status is `New` (not yet started)
- **In Progress** — status is `In progress` or `On hold`
- **Done** — completed, per the existing `isWorkPackageCompleted()` convention

The panel sits beside the existing Burnup chart (`BurnupChart`), matching its
period selector (`week` / `month` / `quarter`) and loading/empty states.

## Scope decisions (confirmed)
1. **Work package types**: Task + Bug only — same filter as the existing
   Burnup chart, for an apples-to-apples "dev work" view.
2. **Lane granularity**: 3 lanes only. `On hold` is folded into
   **In Progress**, not broken out separately.
3. **Placement**: New chart sits **beside** the existing Burnup chart (same
   row, side by side), not replacing it.

## Codebase context (already verified)
- Data source: `useFilters()` → `workPackages: WorkPackage[]`, populated from
  `/api/openproject/work-packages`, which wraps OpenProject's
  `GET /api/v3/work_packages` via `lib/openproject-client.ts`.
- `mapStatus()` in `lib/openproject-client.ts` already normalizes every raw
  OpenProject status title into one of 4 buckets stored on `wp.status`:
  `"New" | "In progress" | "On hold" | "Closed"`. `wp.statusLabel` retains the
  raw OpenProject title. No new API fields are required.
- `isWorkPackageCompleted()` (`lib/stats.ts`) is the existing "done" check
  used by Burnup/Trend charts (`statusLabel === "done"`, case-insensitive, or
  100% + "done"). Reusing it keeps the new CFD panel consistent with existing
  completion semantics rather than introducing a second definition of "done".
- `computeBurnup()` (`lib/stats.ts`) already implements the exact "walk one
  day at a time from start-of-period to today, count cumulative scope vs.
  cumulative completed" pattern this feature needs — the CFD computation is a
  3-lane variant of the same loop.
- `BurnupChart` (`components/dashboard/burnup-chart.tsx`) is the visual
  template: Chart.js `Line`, stepped, theme-aware via `useChartInk()`, colored
  via `lib/chart-theme.ts`'s `CATEGORICAL` palette, wrapped in the standard
  `Card`/`CardHeader`/`CardTitle` shell with a `data.length === 0` empty state.

## Implementation steps

### 1. `lib/types.ts` — add `CfdPoint`
```ts
export interface CfdPoint {
  label: string;      // e.g. "7/24"
  date: string;        // ISO date, start of day (UTC)
  backlog: number;     // cumulative count, status === "New"
  inProgress: number;  // cumulative count, status "In progress" | "On hold"
  done: number;        // cumulative count, isWorkPackageCompleted
}
```

### 2. `lib/stats.ts` — add `computeCumulativeFlow`
```
computeCumulativeFlow(workPackages: WorkPackage[], period: Period): CfdPoint[]
```
- Filter to `wp.type === "Task" || wp.type === "Bug"` (identical to
  `computeBurnup`).
- Reuse the same daily-walk skeleton as `computeBurnup`: determine `start`
  via `startOfWeek` / `startOfMonth` / `startOfQuarter` based on `period`,
  then iterate one point per day from `start` through today using `addDays`.
- For each day (`dayEnd` = day boundary), among tickets created before
  `dayEnd`:
  - `done` = `isWorkPackageCompleted(wp)` AND completion date
    (`closedAt ?? updatedAt`) `< dayEnd`
  - `inProgress` = not done AND `wp.status === "In progress" || wp.status === "On hold"`
  - `backlog` = not done AND `wp.status === "New"`
- These three counts are mutually exclusive; their sum should equal the same
  cumulative "scope" total as `computeBurnup`'s `total` field — useful as a
  manual cross-check when validating the implementation.

### 3. `components/dashboard/cfd-chart.tsx` — new component
- Structurally mirrors `BurnupChart`.
- Chart.js `Line`, `stacked: true` on both x/y scales, `fill: true`, stepped.
- 3 datasets stacked bottom→top so growth reads naturally:
  1. **Done** — `CATEGORICAL.aqua`
  2. **In Progress** — `CATEGORICAL.yellow`
  3. **Backlog** — `CATEGORICAL.blue`
- Uses `useChartInk()` for theme-aware legend/tooltip/grid/tick colors,
  identical `Card`/`CardHeader`/`CardTitle` wrapper, identical
  `data.length === 0` → "No data" empty state.

### 4. `app/(app)/dashboard/page.tsx` — wire it up
- Add memo:
  ```ts
  const cfd = useMemo(() => computeCumulativeFlow(workPackages, period), [workPackages, period]);
  ```
- Add a `CFD_TITLES: Record<Period, string>` map next to `BURNUP_TITLES`,
  e.g. `"Cumulative flow (this week/month/quarter)"`.
- Replace the current single full-width Burnup `<div>` row with:
  ```tsx
  <div className="grid gap-4 lg:grid-cols-2">
    <div>{loading ? <Skeleton className="h-80 w-full" /> : <BurnupChart title={burnupTitle} data={burnup} />}</div>
    <div>{loading ? <Skeleton className="h-80 w-full" /> : <CfdChart title={cfdTitle} data={cfd} />}</div>
  </div>
  ```

### 5. API / service changes
None required — `type`, `status`, `createdAt`, `closedAt`, `updatedAt` are
already fetched and mapped by `lib/openproject-client.ts` from OpenProject's
`GET /api/v3/work_packages` response.

## Files touched
- `lib/types.ts` (add type)
- `lib/stats.ts` (add computation function)
- `components/dashboard/cfd-chart.tsx` (new file)
- `app/(app)/dashboard/page.tsx` (wire up new memo + chart, adjust burnup row layout)

## Out of scope / notes
- Not fixing the pre-existing `isWorkPackageCompleted` vs. `mapStatus`
  "Closed" naming mismatch (statuses titled "Closed"/"Rejected" map to bucket
  `"Closed"`, but completion is checked against the literal label `"done"`).
  This plan reuses the existing helper as-is for consistency; flagging it
  here in case it's worth a separate fix.
- Dummy/demo data (`data/dummy-work-packages.json`) does not set
  `statusLabel`, so it inherits `statusLabel = status` (e.g. `"Closed"`), not
  `"Done"` — meaning `isWorkPackageCompleted()` will return `false` for all
  dummy tickets, and the Done lane (and existing Burnup "Completed" line)
  will render as flat 0 in demo/dummy mode. This is pre-existing behavior,
  not something introduced by this feature.
