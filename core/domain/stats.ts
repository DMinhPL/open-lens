import type {
  BurnupPoint,
  CfdPoint,
  CycleTimePoint,
  DailyTypeTrendPoint,
  DashboardStats,
  DateRange,
  StatusBreakdown,
  TaskBugWorkloadEntry,
  TrendGranularity,
  TrendPoint,
  ThroughputPoint,
  TypeBreakdown,
  TypeThroughput,
  WorkPackage,
  WorkloadEntry,
  WorkloadGroupBy,
} from "@/core/domain/types";
import { DUMMY_STATUS_NAMES } from "@/core/colors/status-colors";
import { CFD_STAGE_BY_STATUS, type CfdStage } from "@/core/domain/cfd-stages";
import { getDateRangeBounds, getTrendGranularity, isWithinDateRange } from "@/core/domain/date-range";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday as start of week
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function startOfQuarter(date: Date): Date {
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1));
}

function addQuarters(date: Date, quarters: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + quarters * 3, 1));
}

/** Every UTC day of the range up to and including today, so future days don't plot as flat lines. */
function daysInRange(range: DateRange): Date[] {
  const { start, end } = getDateRangeBounds(range);
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const last = end < tomorrow ? end : tomorrow;

  const days: Date[] = [];
  for (let day = start; day < last; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * Determines if a work package is completed.
 * A work package is considered completed if:
 * - It has 100% progress and status is "done", OR
 * - Status is "done", "closed", or "developed"
 * @param {WorkPackage} wp - The work package to check
 * @returns {boolean} True if the work package is completed, false otherwise
 */
export function isWorkPackageCompleted(wp: WorkPackage): boolean {
  const statusLabel = wp.statusLabel?.trim().toLowerCase();
  return (wp.percentDone === 100 && statusLabel === "done") || statusLabel === "done" || statusLabel === "developed";
}

/**
 * Counts the number of completed work packages within a date range.
 * @param {WorkPackage[]} workPackages - Array of work packages to filter
 * @param {Date} start - Start date (inclusive)
 * @param {Date} end - End date (exclusive)
 * @returns {number} Count of completed work packages in the range
 */
function closedInRange(workPackages: WorkPackage[], start: Date, end: Date): number {
  const res = workPackages.filter((wp) => {
    const completedAt = new Date(wp.closedAt ?? wp.updatedAt);
    return completedAt >= start && completedAt < end && isWorkPackageCompleted(wp);
  });
  return res.length;
}

export function countCompletedSince(workPackages: WorkPackage[], since: Date): number {
  return closedInRange(workPackages, since, new Date());
}

export function computeWeeklyTrend(workPackages: WorkPackage[], numWeeks = 12): TrendPoint[] {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const points: TrendPoint[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeekStart, -7 * i);
    const weekEnd = addDays(weekStart, 7);
    points.push({
      label: `${weekStart.getUTCDate()}/${weekStart.getUTCMonth() + 1}`,
      periodStart: weekStart.toISOString(),
      completed: closedInRange(workPackages, weekStart, weekEnd),
    });
  }

  return points;
}

const TREND_BUCKETS: Record<
  TrendGranularity,
  { startOf: (date: Date) => Date; next: (date: Date) => Date; label: (date: Date) => string }
> = {
  week: {
    startOf: startOfWeek,
    next: (date) => addDays(date, 7),
    label: (date) => `${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
  },
  month: {
    startOf: startOfMonth,
    next: (date) => addMonths(date, 1),
    label: (date) => date.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
  },
  quarter: {
    startOf: startOfQuarter,
    next: (date) => addQuarters(date, 1),
    label: (date) => `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`,
  },
};

/**
 * Completed tickets per week/month/quarter across the selected range; the bucket size comes from
 * the range length (see `getTrendGranularity`). Edge buckets are clipped to the range, so a
 * partial first or last bucket only counts completions inside the range.
 */
export function computeTrend(workPackages: WorkPackage[], range: DateRange): TrendPoint[] {
  const { start, end } = getDateRangeBounds(range);
  const bucket = TREND_BUCKETS[getTrendGranularity(range)];
  const points: TrendPoint[] = [];

  for (let bucketStart = bucket.startOf(start); bucketStart < end; bucketStart = bucket.next(bucketStart)) {
    const bucketEnd = bucket.next(bucketStart);
    points.push({
      label: bucket.label(bucketStart),
      periodStart: bucketStart.toISOString(),
      completed: closedInRange(
        workPackages,
        bucketStart < start ? start : bucketStart,
        bucketEnd > end ? end : bucketEnd,
      ),
    });
  }

  return points;
}

export function computeStatusBreakdown(
  workPackages: WorkPackage[],
  statusNames: string[] = DUMMY_STATUS_NAMES,
): StatusBreakdown[] {
  const counts = new Map<string, number>();
  for (const wp of workPackages) {
    const status = wp.statusLabel || wp.status;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return statusNames.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export function computeWorkload(
  workPackages: WorkPackage[],
  groupBy: WorkloadGroupBy,
  initialKeys: Iterable<string> = [],
): WorkloadEntry[] {
  const counts = new Map<string, number>();
  for (const key of initialKeys) {
    if (key) counts.set(key, 0);
  }
  for (const wp of workPackages) {
    const key = wp[groupBy];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Counts only open-workload types shown by the workload chart, preserving zero-count seeded members. */
export function computeTaskBugWorkload(
  workPackages: WorkPackage[],
  groupBy: WorkloadGroupBy,
  initialKeys: Iterable<string> = [],
): TaskBugWorkloadEntry[] {
  const counts = new Map<string, TaskBugWorkloadEntry>();
  for (const key of initialKeys) {
    if (key) counts.set(key, { key, taskCount: 0, bugCount: 0 });
  }

  for (const workPackage of workPackages) {
    const type = workPackage.type.trim().toLowerCase();
    if (type !== "task" && type !== "bug") continue;

    const key = workPackage[groupBy];
    const entry = counts.get(key) ?? { key, taskCount: 0, bugCount: 0 };
    if (type === "task") entry.taskCount += 1;
    else entry.bugCount += 1;
    counts.set(key, entry);
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.taskCount + b.bugCount - (a.taskCount + a.bugCount) || a.key.localeCompare(b.key),
  );
}

/**
 * Groups work packages by their `type` (Bug, Task, User Story, ...), sorted by count desc.
 * Unlike statuses, types aren't fetched from a separate catalog endpoint, so the list of
 * types is derived directly from the data instead of a fixed reference list.
 */
export function computeTypeBreakdown(workPackages: WorkPackage[]): TypeBreakdown[] {
  const counts = new Map<string, number>();
  for (const wp of workPackages) {
    counts.set(wp.type, (counts.get(wp.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Daily (UTC) count of tickets created per type, for the last `numDays` days including today.
 * Granularity is always daily regardless of the selected date range, since
 * spotting a day where tickets pile up requires day-level resolution.
 */
export function computeDailyTypeTrend(workPackages: WorkPackage[], numDays = 14): DailyTypeTrendPoint[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const points: DailyTypeTrendPoint[] = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const dayStart = addDays(today, -i);
    const dayEnd = addDays(dayStart, 1);
    const byType: Record<string, number> = {};

    for (const wp of workPackages) {
      const created = new Date(wp.createdAt);
      if (created >= dayStart && created < dayEnd) {
        byType[wp.type] = (byType[wp.type] ?? 0) + 1;
      }
    }

    points.push({
      label: `${dayStart.getUTCDate()}/${dayStart.getUTCMonth() + 1}`,
      date: dayStart.toISOString(),
      byType,
    });
  }

  return points;
}

/**
 * Per-type throughput (created vs. completed) within the selected date range, reusing the
 * same inclusive-day semantics as `isWithinDateRange` elsewhere in the app.
 */
export function computeTypeThroughput(workPackages: WorkPackage[], range: DateRange): TypeThroughput[] {
  const created = new Map<string, number>();
  const completed = new Map<string, number>();

  for (const wp of workPackages) {
    if (isWithinDateRange(wp.createdAt, range)) {
      created.set(wp.type, (created.get(wp.type) ?? 0) + 1);
    }
    if (isWorkPackageCompleted(wp) && isWithinDateRange(wp.closedAt ?? wp.updatedAt, range)) {
      completed.set(wp.type, (completed.get(wp.type) ?? 0) + 1);
    }
  }

  const types = new Set([...created.keys(), ...completed.keys()]);
  return Array.from(types)
    .map((type) => ({ type, created: created.get(type) ?? 0, completed: completed.get(type) ?? 0 }))
    .sort((a, b) => b.created + b.completed - (a.created + a.completed));
}

/**
 * Burnup series for Task/Bug tickets: cumulative scope (created) vs. cumulative completed
 * (Done), sampled daily across the selected range (capped at today).
 */
export function computeBurnup(workPackages: WorkPackage[], range: DateRange): BurnupPoint[] {
  const relevant = workPackages.filter((wp) => wp.type === "Task" || wp.type === "Bug");

  const points: BurnupPoint[] = [];
  for (const dayStart of daysInRange(range)) {
    const dayEnd = addDays(dayStart, 1);

    const total = relevant.filter((wp) => new Date(wp.createdAt) < dayEnd).length;
    const completed = relevant.filter(
      (wp) => isWorkPackageCompleted(wp) && new Date(wp.closedAt ?? wp.updatedAt) < dayEnd,
    ).length;

    points.push({
      label: `${dayStart.getUTCDate()}/${dayStart.getUTCMonth() + 1}`,
      date: dayStart.toISOString(),
      completed,
      total,
    });
  }

  return points;
}

function classifyCfdStage(wp: WorkPackage): CfdStage {
  const statusLabel = wp.statusLabel?.trim().toLowerCase();
  const stage = statusLabel ? CFD_STAGE_BY_STATUS[statusLabel] : undefined;
  if (stage) return stage;
  return isWorkPackageCompleted(wp) ? "done" : "backlog";
}

/**
 * Cumulative flow series for Task/Bug tickets, sampled daily across the selected
 * range (capped at today). Splits the workflow into six stages
 * (backlog → ready → development → review → testing/acceptance → done) so
 * bottlenecks between coding, review, and QA are visible instead of hidden
 * inside a single "In Progress" band.
 */
export function computeCumulativeFlow(workPackages: WorkPackage[], range: DateRange): CfdPoint[] {
  const relevant = workPackages.filter((wp) => wp.type === "Task" || wp.type === "Bug");
  const points: CfdPoint[] = [];
  for (const dayStart of daysInRange(range)) {
    const dayEnd = addDays(dayStart, 1);
    const counts: Record<CfdStage, number> = {
      backlog: 0,
      ready: 0,
      development: 0,
      review: 0,
      testing: 0,
      done: 0,
    };

    for (const wp of relevant) {
      if (new Date(wp.createdAt) >= dayEnd) continue;
      counts[classifyCfdStage(wp)]++;
    }

    points.push({
      label: `${dayStart.getUTCDate()}/${dayStart.getUTCMonth() + 1}`,
      date: dayStart.toISOString(),
      ...counts,
    });
  }

  return points;
}

/** Completed Task/Bug tickets grouped into seven-day buckets from the start of the selected range. */
export function computeWeeklyThroughput(
  workPackages: WorkPackage[],
  range: DateRange,
): ThroughputPoint[] {
  const relevant = workPackages.filter((wp) => wp.type === "Task" || wp.type === "Bug");
  const { start, end } = getDateRangeBounds(range);
  const now = new Date();
  const points: ThroughputPoint[] = [];

  for (let bucketStart = start; bucketStart < end && bucketStart <= now; bucketStart = addDays(bucketStart, 7)) {
    const bucketEnd = addDays(bucketStart, 7);
    points.push({
      label: `${bucketStart.getUTCDate()}/${bucketStart.getUTCMonth() + 1}`,
      date: bucketStart.toISOString(),
      completedCount: closedInRange(relevant, bucketStart, bucketEnd > end ? end : bucketEnd),
    });
  }

  return points;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / MS_PER_DAY) * 10) / 10);
}

/** Cycle time is an approximation from creation to close, not true time-in-status. */
export function computeCycleTime(workPackages: WorkPackage[], range: DateRange): CycleTimePoint[] {
  return workPackages
    .filter(
      (wp) =>
        (wp.type === "Task" || wp.type === "Bug") &&
        isWorkPackageCompleted(wp) &&
        isWithinDateRange(wp.closedAt ?? wp.updatedAt, range),
    )
    .map((wp) => {
      const completedDate = wp.closedAt ?? wp.updatedAt;
      return {
        id: wp.id,
        label: wp.subject || `#${wp.id}`,
        completedDate,
        cycleTimeDays: daysBetween(new Date(wp.createdAt), new Date(completedDate)),
        type: wp.type,
        statusLabel: wp.statusLabel,
        assignee: wp.assignee,
        project: wp.project,
        createdAt: wp.createdAt,
      };
    })
    .sort((a, b) => a.completedDate.localeCompare(b.completedDate));
}

/** Open (non-Closed) tickets whose `updatedAt` is older than `thresholdDays`, oldest first. */
export function countStuckTickets(workPackages: WorkPackage[], thresholdDays = 2): WorkPackage[] {
  const threshold = addDays(new Date(), -thresholdDays);
  return workPackages
    .filter((wp) => wp.statusLabel !== "Done" && wp.statusLabel !== "Cancelled" && wp.statusLabel !== "Closed" && new Date(wp.updatedAt) < threshold)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

export function computeDashboardStats(workPackages: WorkPackage[]): DashboardStats {
  const now = new Date();
  const weekAgo = addDays(now, -7);
  const monthAgo = addMonths(now, -1);
  const quarterAgo = addQuarters(now, -1);

  const recent = [...workPackages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  return {
    completedThisWeek: countCompletedSince(workPackages, weekAgo),
    completedThisMonth: countCompletedSince(workPackages, monthAgo),
    completedThisQuarter: countCompletedSince(workPackages, quarterAgo),
    openCount: workPackages.filter((wp) => wp.status !== "Closed").length,
    trend: computeWeeklyTrend(workPackages),
    statusBreakdown: computeStatusBreakdown(workPackages),
    recent,
  };
}
