import type { CSSProperties } from "react";
import type { OpenProjectStatus } from "@/lib/types";

/** Dummy fallback used until real statuses load from OpenProject (or if that request fails). */
export const STATUS_COLORS: Record<string, string> = {
  New: "#3997AD",
  "In Progress": "#3852C6",
  Resolved: "#93D2AE",
  Closed: "#DF6DA1",
  Developed: "#1baf7a",
  Open: "#eda100",
  Done: "#51cf66",
  Cancelled: "#ced4da",
};

export const DUMMY_STATUS_NAMES = Object.keys(STATUS_COLORS);

const FALLBACK_COLORS = ["#64748b", "#0ea5e9", "#a855f7", "#84cc16"];

function hashName(name: string): number {
  return Array.from(name.trim().toLowerCase()).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function fallbackColorFor(name: string): string {
  return FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length];
}

/** Ordered list of status names to render, preferring real OpenProject statuses when loaded. */
export function getStatusNames(statuses: OpenProjectStatus[] | null | undefined): string[] {
  return statuses && statuses.length > 0 ? statuses.map((s) => s.name) : DUMMY_STATUS_NAMES;
}

/** Maps status name -> color, preferring real OpenProject statuses when loaded. */
export function buildStatusColorMap(statuses: OpenProjectStatus[] | null | undefined): Record<string, string> {
  if (!statuses || statuses.length === 0) return STATUS_COLORS;

  const map: Record<string, string> = {};
  for (const status of statuses) {
    map[status.name] = status.color || STATUS_COLORS[status.name] || fallbackColorFor(status.name);
  }
  return map;
}

export function getStatusColor(name: string, colorMap: Record<string, string>): string {
  return colorMap[name] ?? STATUS_COLORS[name] ?? fallbackColorFor(name);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getStatusBadgeStyle(status: string, colorMap: Record<string, string> = STATUS_COLORS): CSSProperties {
  const color = getStatusColor(status, colorMap);
  return {
    color,
    borderColor: hexToRgba(color, 0.35),
    backgroundColor: hexToRgba(color, 0.12),
  };
}
