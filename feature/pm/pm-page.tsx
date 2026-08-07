"use client";

import { useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useFilters } from "@/core/filters-context";
import { useGetProjectWorkloadQuery } from "@/core/api/api-slice";
import { useAppSelector } from "@/core/store/hooks";
import {
  computeTaskBugWorkload,
  computeStatusBreakdown,
  computeTypeBreakdown,
  computeWeeklyTrend,
  computeMonthlyTrend,
  computeQuarterlyTrend,
  computeYearlyTrend,
  computeBurnup,
  computeCumulativeFlow,
} from "@/core/domain/stats";
import { computeMemberWorkload, computeProjectOverview } from "@/core/domain/pm-stats";
import { getStatusNames } from "@/core/colors/status-colors";
import { WorkloadChart } from "@/components/dashboard/workload-chart";
import { StatusDonut } from "@/feature/dashboard/components/status-donut";
import { TypeDonut } from "@/feature/dashboard/components/type-donut";
import { StatCard } from "@/feature/dashboard/components/stat-card";
import { TrendChart } from "@/feature/dashboard/components/trend-chart";
import { BurnupChart } from "@/feature/dashboard/components/burnup-chart";
import { CfdChart } from "@/feature/dashboard/components/cfd-chart";
import { MemberBreakdownTable } from "@/feature/pm/components/member-breakdown-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, CircleDot, Users } from "lucide-react";
import type { Period } from "@/core/domain/types";

const TREND_TITLES: Record<Period, string> = {
  week: "Completed per week",
  month: "Completed per month",
  quarter: "Completed per quarter",
  year: "Completed per year",
};

const BURNUP_TITLES: Record<Period, string> = {
  week: "Task & Bug burnup (this week)",
  month: "Task & Bug burnup (this month)",
  quarter: "Task & Bug burnup (this quarter)",
  year: "Task & Bug burnup (this year)",
};

const CFD_TITLES: Record<Period, string> = {
  week: "Cumulative flow (this week)",
  month: "Cumulative flow (this month)",
  quarter: "Cumulative flow (this quarter)",
  year: "Cumulative flow (this year)",
};

/**
 * Project Manager mode's landing page: aggregates every assignee's tasks/bugs for one
 * selected project, reusing the same `getProjectWorkload` fetch and several chart components
 * the single-user Workload/Dashboard pages already use — see `core/domain/pm-stats.ts` for
 * the multi-member aggregation this page adds on top of that shared data.
 */
export default function PmPage() {
  const { project, projects, period } = useFilters();
  const statuses = useAppSelector((state) => state.common.statuses);
  const projectId = project === "all" ? null : Number(project);
  const hasValidProject = projectId !== null && Number.isSafeInteger(projectId) && projectId > 0;
  const {
    data,
    isFetching: loading,
    error: queryError,
  } = useGetProjectWorkloadQuery(hasValidProject ? projectId : skipToken);
  const error = queryError ? ((queryError as { message?: string }).message ?? "Request failed") : null;
  const workPackages = useMemo(() => data?.workPackages ?? [], [data]);
  const members = useMemo(() => data?.members ?? [], [data]);
  const projectName = projects.find((candidate) => candidate.id === projectId)?.name ?? "Selected project";

  const overview = useMemo(
    () => computeProjectOverview(workPackages, members, statuses),
    [workPackages, members, statuses],
  );
  const memberStats = useMemo(
    () => computeMemberWorkload(workPackages, members, statuses).filter((member) => member.totalCount > 0),
    [workPackages, members, statuses],
  );
  const workload = useMemo(
    () =>
      computeTaskBugWorkload(workPackages, "assignee", members.map((m) => m.name)).filter(
        (entry) => entry.taskCount + entry.bugCount > 0,
      ),
    [workPackages, members],
  );
  const statusBreakdown = useMemo(
    () => computeStatusBreakdown(workPackages, getStatusNames(statuses)),
    [workPackages, statuses],
  );
  const typeBreakdown = useMemo(() => computeTypeBreakdown(workPackages), [workPackages]);
  const trend = useMemo(() => {
    if (period === "week") return computeWeeklyTrend(workPackages, 12);
    if (period === "quarter") return computeQuarterlyTrend(workPackages, 4);
    if (period === "year") return computeYearlyTrend(workPackages, 3);
    return computeMonthlyTrend(workPackages, 6);
  }, [workPackages, period]);
  const burnup = useMemo(() => computeBurnup(workPackages, period), [workPackages, period]);
  const cfd = useMemo(() => computeCumulativeFlow(workPackages, period), [workPackages, period]);

  const trendTitle = TREND_TITLES[period];
  const burnupTitle = BURNUP_TITLES[period];
  const cfdTitle = CFD_TITLES[period];

  if (!hasValidProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Team overview</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Select a specific project from the top bar to view its team&apos;s aggregated tasks and bugs.
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard title="Team members" value={overview.memberCount} icon={Users} />
            <StatCard title="Open tickets" value={overview.openCount} icon={CircleDot} />
            <StatCard
              title="Overdue tickets"
              value={overview.overdueCount}
              icon={AlertTriangle}
              className={overview.overdueCount > 0 ? "border-amber-300 dark:border-amber-800" : undefined}
            />
            <StatCard title="Completion rate" value={`${overview.completionRate}%`} icon={CheckCircle2} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Open Task and Bug workload for {projectName} by assignee
          </CardTitle>
        </CardHeader>
        <CardContent>{loading ? <Skeleton className="h-64 w-full" /> : <WorkloadChart data={workload} />}</CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <StatusDonut data={statusBreakdown} />}</div>
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <TypeDonut data={typeBreakdown} />}</div>
      </div>

      <div>{loading ? <Skeleton className="h-80 w-full" /> : <TrendChart title={trendTitle} data={trend} />}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {loading ? <Skeleton className="h-80 w-full" /> : <BurnupChart title={burnupTitle} data={burnup} />}
        </div>
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <CfdChart title={cfdTitle} data={cfd} />}</div>
      </div>

      <MemberBreakdownTable members={memberStats} loading={loading} />
    </div>
  );
}
