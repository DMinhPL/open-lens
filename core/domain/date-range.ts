import { format, subMonths } from "date-fns";
import type { DateRange, TrendGranularity } from "@/core/domain/types";

export const DEFAULT_RANGE_MONTHS = 3;
export const ALL_TIME_START = "2010-01-01";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Ranges up to ~3 months chart weekly, up to 2 years monthly, anything longer quarterly.
const WEEKLY_MAX_DAYS = 100;
const MONTHLY_MAX_DAYS = 731;

/** Today and the same day `months` months earlier, as local calendar dates. */
export function getLastMonthsRange(months: number, now = new Date()): DateRange {
  return {
    from: format(subMonths(now, months), "yyyy-MM-dd"),
    to: format(now, "yyyy-MM-dd"),
  };
}

/** From `ALL_TIME_START` through today: the "All" preset, covering the whole OpenProject history. */
export function getAllTimeRange(now = new Date()): DateRange {
  return { from: ALL_TIME_START, to: format(now, "yyyy-MM-dd") };
}

export function getDefaultDateRange(now = new Date()): DateRange {
  return getLastMonthsRange(DEFAULT_RANGE_MONTHS, now);
}

/**
 * Calendar quarter (1–4) of `year`, with the end capped at today so the current quarter
 * doesn't extend into the future. `null` when the quarter hasn't started yet.
 */
export function getQuarterRange(quarter: 1 | 2 | 3 | 4, year: number, now = new Date()): DateRange | null {
  const from = format(new Date(year, (quarter - 1) * 3, 1), "yyyy-MM-dd");
  const quarterEnd = format(new Date(year, quarter * 3, 0), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");
  if (from > today) return null;
  return { from, to: quarterEnd < today ? quarterEnd : today };
}

function parseIsoDateUtc(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects rollovers such as 2026-02-31, which `Date` silently turns into March 3rd.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function isValidDateRange(range: { from?: string | null; to?: string | null }): range is DateRange {
  if (!range.from || !range.to) return false;
  const from = parseIsoDateUtc(range.from);
  const to = parseIsoDateUtc(range.to);
  return from !== null && to !== null && from <= to;
}

/** Reads `from`/`to` query params (default range when both are absent); `null` when they're invalid. */
export function parseDateRangeParams(params: URLSearchParams): DateRange | null {
  const range = { from: params.get("from"), to: params.get("to") };
  if (!range.from && !range.to) return getDefaultDateRange();
  return isValidDateRange(range) ? range : null;
}

/** UTC bounds of the range: `start` is midnight of `from`, `end` is midnight after `to` (exclusive). */
export function getDateRangeBounds(range: DateRange): { start: Date; end: Date } {
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** True when the ISO timestamp falls on any day between `range.from` and `range.to`, inclusive. */
export function isWithinDateRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  console.log("isWithinDateRange", value, range);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const { start, end } = getDateRangeBounds(range);
  return date >= start && date < end;
}

export function getTrendGranularity(range: DateRange): TrendGranularity {
  const { start, end } = getDateRangeBounds(range);
  const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  if (days <= WEEKLY_MAX_DAYS) return "week";
  if (days <= MONTHLY_MAX_DAYS) return "month";
  return "quarter";
}

function formatDay(value: string, withYear: boolean) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** Compact label such as "12 Jul – 12 Oct 2026", repeating the year only when it differs. */
export function formatDateRangeLabel(range: DateRange): string {
  if (range.from === range.to) return formatDay(range.from, true);
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `${formatDay(range.from, !sameYear)} – ${formatDay(range.to, true)}`;
}
