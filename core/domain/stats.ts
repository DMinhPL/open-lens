import type {
  BurnupPoint,
  CfdPoint,
  DailyTypeTrendPoint,
  DashboardStats,
  Period,
  StatusBreakdown,
  TrendPoint,
  TypeBreakdown,
  TypeThroughput,
  WorkPackage,
  WorkloadEntry,
  WorkloadGroupBy,
} from "@/core/domain/types";
import { DUMMY_STATUS_NAMES } from "@/core/colors/status-colors";
import { wasCreatedInPeriod } from "@/core/domain/work-package-filters";

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

export function isWorkPackageCompleted(wp: WorkPackage): boolean {
  return (wp.percentDone === 100 && wp.statusLabel?.trim().toLowerCase() === "done") || wp.statusLabel?.trim().toLowerCase() === "done";
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
      label: `${weekStart.getUTCMonth() + 1}/${weekStart.getUTCDate()}`,
      periodStart: weekStart.toISOString(),
      completed: closedInRange(workPackages, weekStart, weekEnd),
    });
  }

  return points;
}

export function computeMonthlyTrend(workPackages: WorkPackage[], numMonths = 6): TrendPoint[] {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const points: TrendPoint[] = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const monthStart = addMonths(currentMonthStart, -i);
    const monthEnd = addMonths(currentMonthStart, -i + 1);
    points.push({
      label: monthStart.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      periodStart: monthStart.toISOString(),
      completed: closedInRange(workPackages, monthStart, monthEnd),
    });
  }

  return points;
}

export function computeQuarterlyTrend(workPackages: WorkPackage[], numQuarters = 4): TrendPoint[] {
  const now = new Date();
  const currentQuarterStart = startOfQuarter(now);
  const points: TrendPoint[] = [];

  for (let i = numQuarters - 1; i >= 0; i--) {
    const qStart = addQuarters(currentQuarterStart, -i);
    const qEnd = addQuarters(currentQuarterStart, -i + 1);
    const q = Math.floor(qStart.getUTCMonth() / 3) + 1;
    points.push({
      label: `Q${q} ${qStart.getUTCFullYear()}`,
      periodStart: qStart.toISOString(),
      completed: closedInRange(workPackages, qStart, qEnd),
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

export function computeWorkload(workPackages: WorkPackage[], groupBy: WorkloadGroupBy): WorkloadEntry[] {
  const counts = new Map<string, number>();
  for (const wp of workPackages) {
    const key = wp[groupBy];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
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
 * Granularity is always daily regardless of the week/month/quarter period selector, since
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
      label: `${dayStart.getUTCMonth() + 1}/${dayStart.getUTCDate()}`,
      date: dayStart.toISOString(),
      byType,
    });
  }

  return points;
}

/**
 * Per-type throughput (created vs. completed) within the currently selected period, reusing
 * the same period-window semantics as `wasCreatedInPeriod` elsewhere in the app.
 */
export function computeTypeThroughput(workPackages: WorkPackage[], period: Period): TypeThroughput[] {
  const created = new Map<string, number>();
  const completed = new Map<string, number>();

  for (const wp of workPackages) {
    if (wasCreatedInPeriod(wp.createdAt, period)) {
      created.set(wp.type, (created.get(wp.type) ?? 0) + 1);
    }
    if (isWorkPackageCompleted(wp) && wasCreatedInPeriod(wp.closedAt ?? wp.updatedAt, period)) {
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
 * (Done), sampled daily from the start of the selected period through today.
 */
export function computeBurnup(workPackages: WorkPackage[], period: Period): BurnupPoint[] {
  const relevant = workPackages.filter((wp) => wp.type === "Task" || wp.type === "Bug");
  const now = new Date();
  const start =
    period === "week" ? startOfWeek(now) : period === "quarter" ? startOfQuarter(now) : startOfMonth(now);
  const numDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const points: BurnupPoint[] = [];
  for (let i = 0; i < numDays; i++) {
    const dayStart = addDays(start, i);
    const dayEnd = addDays(dayStart, 1);

    const total = relevant.filter((wp) => new Date(wp.createdAt) < dayEnd).length;
    const completed = relevant.filter(
      (wp) => isWorkPackageCompleted(wp) && new Date(wp.closedAt ?? wp.updatedAt) < dayEnd,
    ).length;

    points.push({
      label: `${dayStart.getUTCMonth() + 1}/${dayStart.getUTCDate()}`,
      date: dayStart.toISOString(),
      completed,
      total,
    });
  }

  return points;
}

/**
 * Cumulative flow series for Task/Bug tickets, sampled daily from the start of
 * the selected period through today.
 */
export function computeCumulativeFlow(workPackages: WorkPackage[], period: Period): CfdPoint[] {
  const relevant = workPackages.filter((wp) => wp.type === "Task" || wp.type === "Bug");
  const now = new Date();
  const start =
    period === "week" ? startOfWeek(now) : period === "quarter" ? startOfQuarter(now) : startOfMonth(now);
  const numDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const points: CfdPoint[] = [];
  for (let i = 0; i < numDays; i++) {
    const dayStart = addDays(start, i);
    const dayEnd = addDays(dayStart, 1);
    let backlog = 0;
    let inProgress = 0;
    let done = 0;

    for (const wp of relevant) {
      if (new Date(wp.createdAt) >= dayEnd) continue;

      const completed =
        isWorkPackageCompleted(wp) && new Date(wp.closedAt ?? wp.updatedAt) < dayEnd;
      if (completed) {
        done++;
      } else if (wp.statusLabel === "In Progress" || wp.statusLabel === "On hold") {
        inProgress++;
      } else if (wp.statusLabel === "Open") {
        backlog++;
      }
    }

    points.push({
      label: `${dayStart.getUTCMonth() + 1}/${dayStart.getUTCDate()}`,
      date: dayStart.toISOString(),
      backlog,
      inProgress,
      done,
    });
  }

  return points;
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
