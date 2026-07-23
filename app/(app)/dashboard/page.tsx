"use client";

import { useMemo } from "react";
import { useFilters } from "@/lib/filters-context";
import { useApiQuery } from "@/lib/api/use-api-query";
import {
  computeWeeklyTrend,
  computeMonthlyTrend,
  computeQuarterlyTrend,
  computeStatusBreakdown,
  countCompletedSince,
} from "@/lib/stats";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { StatusDonut } from "@/components/dashboard/status-donut";
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
import { CheckCircle2, CircleDot, ListTodo, Timer } from "lucide-react";
import { matchesProject, wasCreatedInPeriod } from "@/lib/work-package-filters";
import type { WorkPackage } from "@/lib/types";

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

export default function DashboardPage() {
  const { workPackages, loading, error, period, project } = useFilters();
  const {
    data: myWorkPackagesData,
    loading: recentLoading,
    error: recentError,
  } = useApiQuery<{ workPackages: WorkPackage[] }>("/api/openproject/work-packages?mine=true");

  const completedThisWeek = useMemo(() => countCompletedSince(workPackages, daysAgo(7)), [workPackages]);
  const completedThisMonth = useMemo(() => countCompletedSince(workPackages, monthsAgo(1)), [workPackages]);
  const completedThisQuarter = useMemo(() => countCompletedSince(workPackages, monthsAgo(3)), [workPackages]);
  const openCount = useMemo(() => workPackages.filter((wp) => wp.status !== "Closed").length, [workPackages]);

  const trend = useMemo(() => {
    if (period === "week") return computeWeeklyTrend(workPackages, 12);
    if (period === "quarter") return computeQuarterlyTrend(workPackages, 4);
    return computeMonthlyTrend(workPackages, 6);
  }, [workPackages, period]);

  const statusBreakdown = useMemo(() => computeStatusBreakdown(workPackages), [workPackages]);

  const recentList = useMemo(
    () =>
      (myWorkPackagesData?.workPackages ?? [])
        .filter((workPackage) => matchesProject(workPackage, project))
        .filter((workPackage) => wasCreatedInPeriod(workPackage.createdAt, period))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [myWorkPackagesData, project, period],
  );

  const trendTitle =
    period === "week" ? "Completed per week" : period === "quarter" ? "Completed per quarter" : "Completed per month";

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="dashboard-container flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard title="Completed this week" value={completedThisWeek} icon={CheckCircle2} />
            <StatCard title="Completed this month" value={completedThisMonth} icon={CheckCircle2} />
            <StatCard title="Completed this quarter" value={completedThisQuarter} icon={Timer} />
            <StatCard title="Open tickets" value={openCount} icon={CircleDot} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? <Skeleton className="h-80 w-full" /> : <TrendChart title={trendTitle} data={trend} />}
        </div>
        <div>{loading ? <Skeleton className="h-80 w-full" /> : <StatusDonut data={statusBreakdown} />}</div>
      </div>

      <div className="rounded-lg border recent-tickets-container">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ListTodo className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">My recent tickets</h2>
        </div>
        {recentLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recentError ? (
          <p className="p-4 text-sm text-destructive">{recentError}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Updated</TableHead>
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
                recentList.map((wp) => (
                  <TableRow key={wp.id}>
                    <TableCell className="font-medium">{wp.subject}</TableCell>
                    <TableCell>
                      <StatusBadge status={wp.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={wp.priority} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{wp.project}</TableCell>
                    <TableCell className="text-muted-foreground">{wp.assignee}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(wp.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
