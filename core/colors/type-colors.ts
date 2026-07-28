import { CHART_CATEGORICAL, CHART_COLORS } from "@/core/colors/chart-theme";

/** Tailwind badge styles for known work package types (used by the Tickets table and dashboard). */
export const TYPE_BADGE_STYLES: Record<string, string> = {
  task: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  bug: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  "user story":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  story:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  feature:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  epic: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  milestone:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  phase: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  risk: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

const TYPE_FALLBACK_STYLES = [
  "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
  "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300",
];

function normalizeType(type: string): string {
  return type.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function hashType(normalized: string): number {
  return Array.from(normalized).reduce((total, character) => total + character.charCodeAt(0), 0);
}

/** Tailwind badge class for a work package type, falling back to a hashed color for unknown types. */
export function getTypeBadgeStyle(type: string): string {
  const normalized = normalizeType(type);
  const knownStyle = TYPE_BADGE_STYLES[normalized];
  if (knownStyle) return knownStyle;

  return TYPE_FALLBACK_STYLES[hashType(normalized) % TYPE_FALLBACK_STYLES.length];
}

/** Hex colors for known work package types, used by chart components (donut/bar). */
export const TYPE_COLOR_HEX: Record<string, string> = {
  task: CHART_COLORS.blue,
  bug: CHART_COLORS.red,
  "user story": CHART_COLORS.yellow,
  story: CHART_COLORS.yellow,
  feature: CHART_COLORS.aqua,
  epic: CHART_COLORS.purple,
  milestone: CHART_COLORS.orange,
  phase: CHART_COLORS.green,
  risk: CHART_COLORS.pink,
};

const CHART_FALLBACK_COLORS = CHART_CATEGORICAL;

/** Hex color for a work package type, falling back to a hashed color for unknown types. */
export function getTypeColor(type: string): string {
  const normalized = normalizeType(type);
  const knownColor = TYPE_COLOR_HEX[normalized];
  if (knownColor) return knownColor;

  return CHART_FALLBACK_COLORS[hashType(normalized) % CHART_FALLBACK_COLORS.length];
}
