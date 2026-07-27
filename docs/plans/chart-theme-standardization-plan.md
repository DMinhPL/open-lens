# Plan: Standardize Chart & App Theme Colors on the New Brand Palette

## Goal
Replace the ad-hoc, duplicated color values currently scattered across chart
components and theme helpers with a single source-of-truth palette based on
the 15 brand swatches supplied by the user, applied consistently across every
chart (Chart.js and Recharts) and reusable in the wider app (badges, tokens)
where appropriate.

**New palette (15 swatches, as provided):**

| Role (proposed)        | Hex Codes |
|-------------------------|-----------|
| Cool / categorical (10) | `#1DBD8E` `#2D3F54` `#52647A` `#73CC80` `#004C94` `#006ECF` `#3C93FA` `#00D4C6` `#0FA69D` `#028183` |
| Warm / accent (5)       | `#F24F4F` `#FF8F5C` `#EEB72B` `#FF57B0` `#9151B8` |

This is a planning document only — no code is changed as part of this task.

## Codebase context (verified via GitNexus + direct file reads)

> Note: GitNexus's FTS/query index for `open-lens` returned empty results
> with a "FTS indexes missing" warning during this investigation. Structural
> lookups (`Glob`/symbol hints) still worked, but semantic `query()` did not.
> **Recommend running `node .gitnexus/run.cjs analyze --repair-fts` (or
> `--force`) before relying on `query()`/`context()` again** — this plan's
> codebase audit was done by direct file reads as a fallback.

### Where chart colors currently live

- **`lib/chart-theme.ts`** — exports `CATEGORICAL` (8 hand-picked hex colors:
  blue/orange/aqua/yellow/magenta/green/violet/red) and `CHART_INK` (a 5-key
  ink/grid palette). `CHART_INK` is **dead code** — nothing imports it.
- **`lib/use-chart-colors.ts`** — `useIsDarkMode()` (watches `prefers-color-scheme`
  + a `data-theme` attribute via `MutationObserver`) and `useChartInk()`, which
  **re-implements** ink/grid/baseline colors as separate hardcoded hex literals
  (`#c3c2b7` / `#52514e` / `#e1e0d9` / `#2c2c2a` / etc.) instead of reusing
  `CHART_INK`. Two sources of truth for the same concept, already diverged.
- **Tooltip styling duplication**: `backgroundColor: ink.isDark ? "#1a1a19" : "#fcfcfb"`,
  `titleColor: ink.isDark ? "#ffffff" : "#0b0b0b"`, `bodyColor: ink.isDark ? "#c3c2b7" : "#52514e"`
  is copy-pasted verbatim in **all 6** Chart.js components (`workload-chart`,
  `trend-chart`, `daily-type-trend-chart`, `type-throughput-chart`,
  `burnup-chart`, `type-donut`, `status-donut`) — 7 occurrences, not derived
  from any shared constant.
- **One-off inline colors** bypassing `CATEGORICAL` entirely:
  - `burnup-chart.tsx`: `scopeColor = ink.isDark ? "#9d8cf5" : "#e9d92c"` (purple/yellow, dark-mode-aware but ad hoc)
  - `cfd-chart.tsx`: `BACKLOG_COLOR = "#55b6d4"` (constant, not theme-aware) and `inProcessColor = ink.isDark ? "#343432" : "#f2f2f0"`
- **`lib/type-colors.ts`** — maps work-package types to `CATEGORICAL` hex
  values (`TYPE_COLOR_HEX`, used by chart legends/bars/donut) **and**
  separately to hardcoded Tailwind utility classes (`TYPE_BADGE_STYLES`, used
  by ticket badges) drawn from an unrelated set of Tailwind color families
  (blue/rose/amber/emerald/fuchsia/cyan/orange/slate/teal/indigo/lime). These
  two mappings are **not derived from the same palette** today, so a ticket's
  chart color and its badge color can look unrelated.
- **`lib/status-colors.ts`** — status colors (`STATUS_COLORS`) are a fallback
  only; real colors come from the OpenProject API (`status.color`) when
  loaded. **Out of scope** for palette standardization — these are
  user-configured in OpenProject, not our design tokens. The hardcoded
  fallback hexes could optionally be aligned to the new palette for
  consistency when OpenProject data hasn't loaded yet (nice-to-have, not
  required).
- **`app/globals.css`** — shadcn/Tailwind v4 theme using `oklch()` values.
  Defines `--chart-1` through `--chart-5` as a **grayscale ramp**
  (`oklch(0.87/0.556/0.439/0.371/0.269 0 0)`) — these are **dead CSS
  variables**: nothing in the codebase references `--color-chart-1..5` or
  `chart-1..5` Tailwind classes. All real chart coloring happens via
  `CATEGORICAL` hex constants passed directly into Chart.js/Recharts props,
  not via CSS variables.
- Two charting libraries are in play: **Chart.js** (`react-chartjs-2`) for
  bar/line/doughnut charts (6 components), and **Recharts** for the CFD area
  chart (`cfd-chart.tsx`) only. Both need to consume the same color source.

### Summary of problems this plan should fix
1. Two divergent "ink" definitions (`CHART_INK` vs. `useChartInk()`); one is dead code.
2. Tooltip styling duplicated 7x instead of centralized.
3. Several charts use inline one-off hex colors instead of the shared palette.
4. `CATEGORICAL` (8 colors) doesn't map cleanly to the new 15-swatch brand
   palette — order, count, and hue groupings need to be redefined.
5. Type badge Tailwind classes and type chart colors are visually unrelated.
6. `--chart-1..5` CSS variables in `globals.css` are dead and grayscale —
   either wire them up as the real source of truth or remove them, don't
   leave both a CSS-variable system and a TS-constant system half-built.

## Proposed design

### 1. Single source of truth: `lib/chart-theme.ts`
Replace `CATEGORICAL` with the new palette, split by role:

```ts
export const CHART_CATEGORICAL = [
  "#1DBD8E", "#2D3F54", "#52647A", "#73CC80", "#004C94",
  "#006ECF", "#3C93FA", "#00D4C6", "#0FA69D", "#028183",
] as const; // primary 10-color categorical sequence (order = adjacent-hue contrast)

export const CHART_ACCENT = {
  red: "#F24F4F",
  orange: "#FF8F5C",
  yellow: "#EEB72B",
  pink: "#FF57B0",
  purple: "#9151B8",
} as const; // semantic/status accents, not part of the default categorical cycle
```

Named aliases (`blue`, `aqua`, etc.) that existing code depends on
(`type-colors.ts`, `workload-chart.tsx`, `trend-chart.tsx`,
`type-throughput-chart.tsx`, `burnup-chart.tsx`, `cfd-chart.tsx`) will be
re-mapped to the closest new swatch — exact mapping table to be finalized in
implementation, e.g.:

| Old `CATEGORICAL` key | Old hex | New hex | New name |
|---|---|---|---|
| blue | `#2a78d6` | `#006ECF` | `blue` |
| orange | `#eb6834` | `#FF8F5C` | `orange` (now an accent) |
| aqua | `#1baf7a` | `#1DBD8E` | `aqua` |
| yellow | `#eda100` | `#EEB72B` | `yellow` (now an accent) |
| magenta | `#e87ba4` | `#FF57B0` | `pink` (now an accent) |
| green | `#008300` | `#73CC80` | `green` |
| violet | `#4a3aa7` | `#9151B8` | `purple` (now an accent) |
| red | `#e34948` | `#F24F4F` | `red` (now an accent) |

This keeps every existing call site's *intent* (bug=red, feature=aqua, etc.)
while sourcing hex values from the approved palette.

### 2. Consolidate ink/tooltip tokens
- Delete dead `CHART_INK` from `chart-theme.ts`.
- Extend `useChartInk()` (or add a sibling `useChartTooltipTheme()`) to return
  a ready-to-spread `tooltip` object (`backgroundColor`, `titleColor`,
  `bodyColor`, `borderColor`, `borderWidth`, `padding`) so all 7 call sites
  do `tooltip: { ...ink.tooltip }` instead of duplicating literals.
- Decide whether ink/grid/baseline hex literals (`#c3c2b7`, `#52514e`,
  `#e1e0d9`, `#2c2c2a`, `#383835`, `#fcfcfb`, `#1a1a19`) should also be pulled
  from the app's existing shadcn CSS variables (`--foreground`,
  `--muted-foreground`, `--border`, `--card`) via `getComputedStyle` at
  runtime, or remain separate literals tuned for chart contrast. Recommend
  keeping them separate literals (charts need higher-contrast, chart-specific
  tuning vs. UI chrome) but document the intentional divergence with a
  comment.

### 3. Resolve `--chart-1..5` dead CSS variables
Two options — pick one during implementation, don't leave dead code:
- **(A) Remove them** from `globals.css` since nothing consumes them and the
  TS-constant approach (`lib/chart-theme.ts`) is the actual source of truth.
- **(B) Wire them up**: replace the grayscale ramp with 5 of the new palette
  hexes (converted to `oklch()`), and migrate chart components to reference
  `var(--color-chart-N)` instead of importing hex constants — this is a
  bigger, higher-risk change (needs hex→oklch conversion, Chart.js/Recharts
  both need runtime-resolved CSS var values, not raw strings) and would be a
  larger follow-up, not part of this pass.
- **Recommendation: Option A** (delete the dead variables) for this pass;
  note Option B as a possible future consolidation once there's real Tailwind
  utility usage for chart colors.

### 4. Type badge colors (`lib/type-colors.ts`)
Two sub-decisions:
- `TYPE_COLOR_HEX` (chart legend colors) should re-map to `CHART_CATEGORICAL`
  entries per the alias table above — low risk, drop-in.
- `TYPE_BADGE_STYLES` (Tailwind classes for ticket badges) is a **separate
  question**: standardizing these to visually match the new chart palette
  would require either (a) custom Tailwind arbitrary-value classes
  (`bg-[#1DBD8E]/10 text-[#1DBD8E] ...`) instead of Tailwind's named color
  scale, or (b) accepting that badges use Tailwind's semantic color names
  while charts use exact brand hex, and only align them loosely (e.g. bug →
  red family in both places). **Recommend scoping this out of the initial
  pass** and flagging it as a fast-follow if the user wants exact-hex badges
  too, since it changes a different UI surface (ticket tables) from what was
  asked (charts).

### 5. Accessibility / contrast check
Several palette swatches are light-to-mid brightness (`#73CC80`, `#EEB72B`,
`#3C93FA`) and will need sufficient contrast against both card backgrounds
(`--card`: white / `oklch(0.205 0 0)` dark) — verify:
- Legend text and axis tick contrast is driven by `ink.text`, not the data
  color, so this is mostly fine.
- Donut/bar fill colors on light vs. dark backgrounds — spot check the
  lightest swatches (`#73CC80`, `#EEB72B`, `#3C93FA`, `#00D4C6`) render with
  visible borders/separation in both themes (Chart.js doughnuts already add
  a `borderColor` matching the card background, which helps).

## Migration steps (for implementation phase — not done in this task)

Per `AGENTS.md`/`CLAUDE.md`, **before editing any symbol below, run
`impact({target, direction: "upstream"})` in GitNexus and report blast radius
+ risk level**, since `CATEGORICAL`, `useChartInk`, and `getTypeColor` are
shared across 7+ chart components. After the FTS repair, re-run `query()` to
confirm nothing else references these symbols beyond what direct file reads
found here.

1. `lib/chart-theme.ts` — replace `CATEGORICAL` with `CHART_CATEGORICAL` +
   `CHART_ACCENT`; remove dead `CHART_INK`.
2. `lib/use-chart-colors.ts` — add centralized tooltip theme helper; keep
   `useIsDarkMode`/ink logic, remove duplication once tooltip helper lands.
3. `lib/type-colors.ts` — re-map `TYPE_COLOR_HEX` to new palette via alias
   table; leave `TYPE_BADGE_STYLES` untouched (out of scope, see §4 above).
4. Chart components — update imports (`CATEGORICAL` → `CHART_CATEGORICAL`/
   `CHART_ACCENT`), replace inline one-off hexes (`burnup-chart.tsx`'s
   `scopeColor`, `cfd-chart.tsx`'s `BACKLOG_COLOR`/`inProcessColor`) with
   named palette/accent references, and adopt the shared tooltip helper:
   - `components/dashboard/workload-chart.tsx`
   - `components/dashboard/trend-chart.tsx`
   - `components/dashboard/daily-type-trend-chart.tsx`
   - `components/dashboard/type-throughput-chart.tsx`
   - `components/dashboard/burnup-chart.tsx`
   - `components/dashboard/cfd-chart.tsx` (Recharts — colors passed as plain
     hex strings to `stroke`/`fill`, same constants work directly)
   - `components/dashboard/type-donut.tsx`
   - `components/dashboard/status-donut.tsx` (only its tooltip/ink styling
     changes — its data colors come from OpenProject, out of scope)
5. `app/globals.css` — remove dead `--chart-1..5` grayscale variables (Option A).
6. Run `detect_changes({scope: "compare", base_ref: "main"})` before
   committing to confirm only the expected chart/theme symbols and dashboard
   execution flows are affected.

## Verification plan
- Start the dev server (`run` skill) and visually check every dashboard chart
  in both light and dark mode: Workload, Trend, Daily Type Trend, Type
  Throughput, Burnup, CFD, Type Donut, Status Donut.
- Confirm tooltip styling is visually identical across all charts (shared
  helper working correctly).
- Confirm no chart regresses to the old hex values (search for old
  `CATEGORICAL` hex literals like `#2a78d6`, `#eb6834`, `#1baf7a`, `#eda100`,
  `#e87ba4`, `#008300`, `#4a3aa7`, `#e34948` post-migration — should be zero
  hits outside this plan doc).
- `pnpm build` / `tsc` (or project's existing type-check script) to confirm
  no type errors from renamed exports.

## Open questions for the user before implementation
1. Confirm the proposed old→new color-role mapping (§1 table) — especially
   that orange/yellow/magenta/violet/red move from "categorical" to "accent"
   role, which changes which chart elements default to them.
2. Should ticket badge colors (`TYPE_BADGE_STYLES`) be restyled to match
   exact brand hex now, or left as Tailwind semantic colors for this pass?
3. Delete the dead `--chart-1..5` CSS variables (Option A), or invest in
   wiring them up as the real source of truth (Option B, larger scope)?
