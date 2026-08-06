import { addDays, differenceInCalendarDays, eachMonthOfInterval, eachWeekOfInterval, format, startOfDay } from "date-fns";
import type { WorkPackage } from "@/core/domain/types";

/** Pixel width of a single day column. Shared by row bars and the header ruler so they stay in scale. */
export const DAY_WIDTH_PX = 28;

/** Width (px) of the fixed task-info column pinned to the left of the timeline. */
export const TASK_COLUMN_WIDTH_PX = 260;

/** The visible timeline window, always spanning at least one day and including "today". */
export interface GanttRange {
  start: Date; // inclusive, start-of-day
  end: Date; // inclusive, start-of-day
  totalDays: number;
}

export interface TaskSpan {
  start: Date;
  end: Date;
}

export function parseDateOnly(value: string): Date {
  return startOfDay(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

/** Status names treated as "actually completed" for {@link getEffectiveDueDate}'s purposes. */
const COMPLETION_STATUS_NAMES = new Set(["done", "resolved", "developed", "confirmed"]);

/**
 * True once a status name is one of the completion states (done/resolved/developed/confirmed) —
 * a coarser, name-only check than {@link isClosedStatus}'s OpenProject `isClosed` flag, used
 * specifically to decide when `updatedAt` should stand in for the due date.
 */
export function isCompletionStatus(statusName: string): boolean {
  return COMPLETION_STATUS_NAMES.has(statusName.trim().toLowerCase());
}

/**
 * The due date to actually use for a task, in favor of the merely-planned one. We don't keep a
 * history of status transitions, so once a task reaches a completion status its `updatedAt`
 * (the most recent change) is the closest signal we have to when it was actually finished —
 * that replaces the originally planned `dueDate`/`derivedDueDate` wherever a due date is shown
 * or measured. Only overrides when a planned due date already existed (so a task that was never
 * scheduled doesn't suddenly gain one just from being marked done).
 */
export function getEffectiveDueDate(workPackage: WorkPackage): string | undefined {
  const plannedEnd = workPackage.dueDate || workPackage.derivedDueDate || undefined;
  if (!plannedEnd) return undefined;

  const statusName = workPackage.statusLabel ?? workPackage.status;
  return isCompletionStatus(statusName) ? workPackage.updatedAt : plannedEnd;
}

/** Status names, beyond {@link isCompletionStatus}, that also mean a task won't move further. */
const OTHER_FINISHED_STATUS_NAMES = new Set(["closed", "cancelled"]);

/** True once a task is done, resolved, closed, cancelled, ... — i.e. genuinely finished, not just open-ended. */
function isFinishedStatus(statusName: string): boolean {
  const normalized = statusName.trim().toLowerCase();
  return COMPLETION_STATUS_NAMES.has(normalized) || OTHER_FINISHED_STATUS_NAMES.has(normalized);
}

/**
 * Resolves the date range a task occupies on the timeline, i.e. its "actual duration". Uses
 * {@link getEffectiveDueDate} for the end date, so a completed task's bar reflects when it was
 * actually finished rather than the originally planned due date.
 *
 * A still-open task (not `isFinishedStatus`) with a start date but no due date at all can't
 * have its real end predicted, but it also isn't a genuine 1-day task — it's ongoing. Rather
 * than collapse to a misleading 1-day marker at `startDate`, its bar is stretched out to
 * `now` so it visibly reads as "still running, no committed due date yet."
 *
 * A finished task (done/closed/cancelled/...) with neither date, or any task with neither date
 * at all, still collapses to a single-day marker at whichever date it does have. Returns `null`
 * only when neither date is set — such tasks can't be placed on a timeline at all.
 */
export function getTaskSpan(workPackage: WorkPackage, now = new Date()): TaskSpan | null {
  const rawStart = workPackage.startDate || undefined;
  const rawEnd = getEffectiveDueDate(workPackage);
  if (!rawStart && !rawEnd) return null;

  const start = rawStart ? parseDateOnly(rawStart) : undefined;
  let end = rawEnd ? parseDateOnly(rawEnd) : undefined;

  const statusName = workPackage.statusLabel ?? workPackage.status;
  if (start && !end && !isFinishedStatus(statusName)) {
    const today = startOfDay(now);
    end = today > start ? today : start;
  }

  if (start && end) return end < start ? { start: end, end: start } : { start, end };
  return { start: (start ?? end) as Date, end: (end ?? start) as Date };
}

/**
 * Computes the [start, end] window covering every task's span, plus today. The past (start)
 * boundary gets 2 days of padding rather than 1 — the extra day-wide cell leaves room for a
 * task bar's start-date label, which renders just to the left of the bar and would otherwise
 * get clipped when a task starts right at the edge of the range.
 */
export function getGanttRange(workPackages: WorkPackage[], now = new Date()): GanttRange {
  const spans = workPackages.map((wp) => getTaskSpan(wp, now)).filter((span): span is TaskSpan => span !== null);
  const today = startOfDay(now);

  const boundaryDates = spans.flatMap((span) => [span.start, span.end]).concat(today);
  const start = addDays(new Date(Math.min(...boundaryDates.map((d) => d.getTime()))), -3);
  const end = addDays(new Date(Math.max(...boundaryDates.map((d) => d.getTime()))), 5);

  return { start, end, totalDays: Math.max(1, differenceInCalendarDays(end, start)) };
}

/** Horizontal offset (px) of a date from the start of the timeline range. */
export function dateOffsetPx(date: Date, range: GanttRange): number {
  return differenceInCalendarDays(startOfDay(date), range.start) * DAY_WIDTH_PX;
}

export interface TaskBarGeometry {
  left: number; // px from the timeline's left edge
  width: number; // px, always at least one day wide
}

/** Position and size (in px) of a task's bar within the shared timeline range. */
export function getTaskBarGeometry(span: TaskSpan, range: GanttRange): TaskBarGeometry {
  const days = Math.max(1, differenceInCalendarDays(span.end, span.start) + 1);
  return { left: dateOffsetPx(span.start, range), width: days * DAY_WIDTH_PX };
}

/**
 * Horizontal offset (px) of a task's *explicit* deadline (`dueDate`), or `null` when none is
 * set. Unlike {@link getTaskSpan}, this deliberately ignores `derivedDueDate` — a schedule
 * computed from a parent's children isn't a deadline anyone committed to, so it shouldn't be
 * marked as one on the chart.
 */
export function getDeadlineOffsetPx(workPackage: WorkPackage, range: GanttRange): number | null {
  return workPackage.dueDate ? dateOffsetPx(parseDateOnly(workPackage.dueDate), range) : null;
}

export interface TimelineTick {
  label: string;
  offsetPx: number;
}

/** Ruler tick marks for the timeline header: weekly for shorter ranges, monthly once that gets too dense to read. */
export function getTimelineTicks(range: GanttRange): TimelineTick[] {
  const spansManyWeeks = range.totalDays / 7 > 20;
  const dates = spansManyWeeks
    ? eachMonthOfInterval({ start: range.start, end: range.end })
    : eachWeekOfInterval({ start: range.start, end: range.end }, { weekStartsOn: 1 });
  const labelFormat = spansManyWeeks ? "MMM yyyy" : "d MMM";

  return dates.map((date) => ({ label: format(date, labelFormat), offsetPx: dateOffsetPx(date, range) }));
}
