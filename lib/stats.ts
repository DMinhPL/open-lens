import type {
  DashboardStats,
  StatusBreakdown,
  TrendPoint,
  WorkPackage,
  WorkPackageStatus,
  WorkloadEntry,
  WorkloadGroupBy,
} from "@/lib/types";

const STATUSES: WorkPackageStatus[] = ["New", "In progress", "Closed", "On hold"];

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

function closedInRange(workPackages: WorkPackage[], start: Date, end: Date): number {
  return workPackages.filter((wp) => {
    if (!wp.closedAt) return false;
    const closed = new Date(wp.closedAt);
    return closed >= start && closed < end;
  }).length;
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

export function computeStatusBreakdown(workPackages: WorkPackage[]): StatusBreakdown[] {
  return STATUSES.map((status) => ({
    status,
    count: workPackages.filter((wp) => wp.status === status).length,
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
