"use client";

import dynamic from "next/dynamic";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetProjectManagerReportQuery } from "@/core/api/api-slice";
import { useFilters } from "@/core/filters-context";
import { StatCard } from "@/feature/dashboard/components/stat-card";
import { MemberBreakdownTable } from "@/feature/pm/components/member-breakdown-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, CircleDot, LoaderCircle, Users } from "lucide-react";
import type { Period } from "@/core/domain/types";

const WorkloadChart = dynamic(
  () => import("@/components/dashboard/workload-chart").then((module) => module.WorkloadChart),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false },
);
const StatusDonut = dynamic(
  () => import("@/feature/dashboard/components/status-donut").then((module) => module.StatusDonut),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false },
);
const TypeDonut = dynamic(
  () => import("@/feature/dashboard/components/type-donut").then((module) => module.TypeDonut),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false },
);
const TrendChart = dynamic(
  () => import("@/feature/dashboard/components/trend-chart").then((module) => module.TrendChart),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false },
);
const BurnupChart = dynamic(
  () => import("@/feature/dashboard/components/burnup-chart").then((module) => module.BurnupChart),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false },
);
const CfdChart = dynamic(
  () => import("@/feature/dashboard/components/cfd-chart").then((module) => module.CfdChart),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false },
);

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

/** Project Manager mode backed by a compact, server-computed report. */
export default function PmPage() {
  const { project, projects, period } = useFilters();
  const projectId = project === "all" ? null : Number(project);
  const hasValidProject = projectId !== null && Number.isSafeInteger(projectId) && projectId > 0;
  const {
    data: report,
    currentData: currentReport,
    isLoading,
    isFetching,
    error: queryError,
  } = useGetProjectManagerReportQuery(
    hasValidProject ? { projectId, period } : skipToken,
  );
  const error = queryError ? ((queryError as { message?: string }).message ?? "Request failed") : null;
  const projectName = projects.find((candidate) => candidate.id === projectId)?.name ?? "Selected project";
  const loading = !report && (isLoading || isFetching);
  const transitioning = isFetching && Boolean(report) && !currentReport;
  const refreshing = isFetching && Boolean(currentReport);

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

  if (error && !report) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="relative flex flex-col gap-6" aria-busy={isFetching}>
      {transitioning ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-50 flex justify-center bg-background/75 backdrop-blur-[2px]"
        >
          <div className="sticky top-24 mt-24 flex h-fit items-center gap-2 rounded-md border bg-background px-4 py-3 text-sm font-medium shadow-lg">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading {period} report…
          </div>
        </div>
      ) : null}
      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="chart-loading flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading {period} report…
        </div>
      ) : refreshing ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          Refreshing {period} report…
        </p>
      ) : null}
      {error && report ? (
        <p className="text-sm text-destructive">Refresh failed; showing cached report: {error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard title="Team members" value={report?.overview.memberCount ?? 0} icon={Users} />
            <StatCard title="Open tickets" value={report?.overview.openCount ?? 0} icon={CircleDot} />
            <StatCard
              title="Overdue tickets"
              value={report?.overview.overdueCount ?? 0}
              icon={AlertTriangle}
              className={(report?.overview.overdueCount ?? 0) > 0 ? "border-amber-300 dark:border-amber-800" : undefined}
            />
            <StatCard title="Completion rate" value={`${report?.overview.completionRate ?? 0}%`} icon={CheckCircle2} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Open Task and Bug workload for {projectName} by assignee
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : <WorkloadChart data={report?.workload ?? []} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {loading ? <Skeleton className="h-80 w-full" /> : <StatusDonut data={report?.statusBreakdown ?? []} />}
        </div>
        <div>
          {loading ? <Skeleton className="h-80 w-full" /> : <TypeDonut data={report?.typeBreakdown ?? []} />}
        </div>
      </div>

      <div>
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <TrendChart title={TREND_TITLES[period]} data={report?.trend ?? []} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <BurnupChart title={BURNUP_TITLES[period]} data={report?.burnup ?? []} />
          )}
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <CfdChart title={CFD_TITLES[period]} data={report?.cfd ?? []} />
          )}
        </div>
      </div>

      <MemberBreakdownTable members={report?.memberStats ?? []} loading={loading} />
    </div>
  );
}
