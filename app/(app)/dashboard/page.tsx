"use client";

import { useMemo } from "react";
import { useFilters } from "@/lib/filters-context";
import { useAppSelector } from "@/lib/store/hooks";
import { getStatusNames } from "@/lib/status-colors";
import {
  computeWeeklyTrend,
  computeMonthlyTrend,
  computeQuarterlyTrend,
  computeStatusBreakdown,
  computeTypeBreakdown,
  computeDailyTypeTrend,
  computeTypeThroughput,
  computeBurnup,
  computeCumulativeFlow,
  countStuckTickets,
  countCompletedSince,
} from "@/lib/stats";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { BurnupChart } from "@/components/dashboard/burnup-chart";
import { CfdChart } from "@/components/dashboard/cfd-chart";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { TypeDonut } from "@/components/dashboard/type-donut";
import { DailyTypeTrendChart } from "@/components/dashboard/daily-type-trend-chart";
import { TypeThroughputChart } from "@/components/dashboard/type-throughput-chart";
import { StuckTicketsList } from "@/components/dashboard/stuck-tickets-list";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, CircleDot, ListTodo, Timer } from "lucide-react";
import {
  matchesProject,
  wasCreatedInPeriod,
  getReleaseDevUrgency,
  getReleaseDevRowClassName,
  getReleaseDevCellClassName,
  getReleaseDevUrgencyLabel,
} from "@/lib/work-package-filters";
import { formatDateDDMMYYYY, cn } from "@/lib/utils";
import { getWorkPackageUrl } from "@/lib/openproject-links";
import { useOpSettings } from "@/lib/use-op-settings";
import type { Period } from "@/lib/types";

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}

const TREND_TITLES: Record<Period, string> = {
  week: "Completed per week",
  month: "Completed per month",
  quarter: "Completed per quarter",
};

const BURNUP_TITLES: Record<Period, string> = {
  week: "Task & Bug burnup (this week)",
  month: "Task & Bug burnup (this month)",
  quarter: "Task & Bug burnup (this quarter)",
};

const CFD_TITLES: Record<Period, string> = {
  week: "Cumulative flow (this week)",
  month: "Cumulative flow (this month)",
  quarter: "Cumulative flow (this quarter)",
};

const THROUGHPUT_TITLES: Record<Period, string> = {
  week: "Created vs completed by type (this week)",
  month: "Created vs completed by type (this month)",
  quarter: "Created vs completed by type (this quarter)",
};

export default function DashboardPage() {
  const { allWorkPackages, workPackages, loading, error, period, project } = useFilters();
  const { settings } = useOpSettings();
  const statuses = useAppSelector((state) => state.common.statuses);

  const completedThisWeek = useMemo(() => countCompletedSince(workPackages ?? [], daysAgo(7)), [workPackages]);
  const completedThisMonth = useMemo(() => countCompletedSince(workPackages ?? [], monthsAgo(1)), [workPackages]);
  const completedThisQuarter = useMemo(() => countCompletedSince(workPackages ?? [], monthsAgo(3)), [workPackages]);
  const openCount = useMemo(() => (workPackages ?? []).filter((wp) => wp.status !== "Closed").length, [workPackages]);
  const trend = useMemo(() => {
    if (period === "week") return computeWeeklyTrend(workPackages, 12);
    if (period === "quarter") return computeQuarterlyTrend(workPackages, 4);
    return computeMonthlyTrend(workPackages, 6);
  }, [workPackages, period]);

  const statusBreakdown = useMemo(
    () => computeStatusBreakdown(workPackages, getStatusNames(statuses)),
    [workPackages, statuses],
  );

  const typeBreakdown = useMemo(() => computeTypeBreakdown(workPackages), [workPackages]);
  const dailyTypeTrend = useMemo(() => computeDailyTypeTrend(workPackages), [workPackages]);
  const typeThroughput = useMemo(
    () => computeTypeThroughput(workPackages, period),
    [workPackages, period],
  );
  const stuckTickets = useMemo(() => countStuckTickets(workPackages), [workPackages]);
  const burnup = useMemo(() => computeBurnup(workPackages, period), [workPackages, period]);
  const cfd = useMemo(() => computeCumulativeFlow(workPackages, period), [workPackages, period]);

  const recentList = useMemo(
    () =>
      allWorkPackages
        .filter((workPackage) => matchesProject(workPackage, project))
        .filter((workPackage) => wasCreatedInPeriod(workPackage.createdAt, period))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 7),
    [allWorkPackages, project, period],
  );

  function navigateToTicket(ticketId: number) {
    window.open(getWorkPackageUrl(settings?.instanceUrl, ticketId), "_blank", "noopener,noreferrer");
  }

  const trendTitle = TREND_TITLES[period];
  const throughputTitle = THROUGHPUT_TITLES[period];
  const burnupTitle = BURNUP_TITLES[period];
  const cfdTitle = CFD_TITLES[period];

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="dashboard-container flex flex-col gap-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard title="Completed this week" value={completedThisWeek} icon={CheckCircle2} />
            <StatCard title="Completed this month" value={completedThisMonth} icon={CheckCircle2} />
            <StatCard title="Completed this quarter" value={completedThisQuarter} icon={Timer} />
            <StatCard title="Open tickets" value={openCount} icon={CircleDot} />
            <StatCard
              title="Stuck tickets"
              value={stuckTickets.length}
              icon={AlertTriangle}
              className={stuckTickets.length > 0 ? "border-amber-300 dark:border-amber-800" : undefined}
            />
          </>
        )}
      </div>

      {/* Trend & Status Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? <Skeleton className="h-80 w-full" /> : <TrendChart title={trendTitle} data={trend} />}
        </div>
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <StatusDonut data={statusBreakdown} />}</div>
      </div>

      {/* Burnup & Cumulative Flow */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {loading ? <Skeleton className="h-80 w-full" /> : <BurnupChart title={burnupTitle} data={burnup} />}
        </div>
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <CfdChart title={cfdTitle} data={cfd} />}</div>
      </div>

      {/* Type Distribution & Daily Trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <TypeDonut data={typeBreakdown} />}</div>
        <div className="lg:col-span-2">
          {loading ? <Skeleton className="h-80 w-full" /> : <DailyTypeTrendChart data={dailyTypeTrend} />}
        </div>
      </div>

      {/* Throughput & Stuck Tickets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <TypeThroughputChart title={throughputTitle} data={typeThroughput} />
          )}
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <StuckTicketsList tickets={stuckTickets} onSelect={navigateToTicket} />
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="rounded-lg border recent-tickets-container">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ListTodo className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">My recent tickets</h2>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Release Dev</TableHead>
                <TableHead className="text-right">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No recent tickets assigned to you.
                  </TableCell>
                </TableRow>
              ) : (
                recentList.map((wp) => {
                  const releaseDevUrgency = getReleaseDevUrgency(wp);

                  return (
                    <TableRow
                      key={wp.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ticket ${wp.subject} in OpenProject${getReleaseDevUrgencyLabel(releaseDevUrgency)}`}
                      className={cn(
                        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        getReleaseDevRowClassName(releaseDevUrgency),
                      )}
                      onClick={() => navigateToTicket(wp.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigateToTicket(wp.id);
                        }
                      }}
                    >
                      <TableCell className="font-medium">{wp.subject}</TableCell>
                      <TableCell>
                        <StatusBadge status={wp.statusLabel ?? wp.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={wp.priority} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{wp.project}</TableCell>
                      <TableCell className="text-muted-foreground">{wp.assignee}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-muted-foreground",
                          getReleaseDevCellClassName(releaseDevUrgency),
                        )}
                      >
                        {formatDateDDMMYYYY(wp.customField25)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateDDMMYYYY(wp.dueDate)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
