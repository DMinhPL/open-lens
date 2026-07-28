export const CHART_CATEGORICAL = [
  "#1DBD8E",
  "#2D3F54",
  "#52647A",
  "#73CC80",
  "#004C94",
  "#006ECF",
  "#3C93FA",
  "#00D4C6",
  "#0FA69D",
  "#028183",
] as const;

export const CHART_ACCENT = {
  red: "#F24F4F",
  orange: "#FF8F5C",
  yellow: "#EEB72B",
  pink: "#FF57B0",
  purple: "#9151B8",
} as const;

/** Semantic aliases keep chart intent readable while sourcing every value from the brand palette. */
export const CHART_COLORS = {
  aqua: CHART_CATEGORICAL[0],
  navy: CHART_CATEGORICAL[1],
  slate: CHART_CATEGORICAL[2],
  green: CHART_CATEGORICAL[3],
  darkBlue: CHART_CATEGORICAL[4],
  blue: CHART_CATEGORICAL[5],
  brightBlue: CHART_CATEGORICAL[6],
  cyan: CHART_CATEGORICAL[7],
  teal: CHART_CATEGORICAL[8],
  darkTeal: CHART_CATEGORICAL[9],
  ...CHART_ACCENT,
} as const;
