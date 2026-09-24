"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePmReportStream } from "@/feature/pm/use-pm-report-stream";
import { useFilters } from "@/core/filters-context";
import { StatCard } from "@/feature/dashboard/components/stat-card";
import { MemberBreakdownTable } from "@/feature/pm/components/member-breakdown-table";
import { ChartHelpDialog } from "@/components/dashboard/chart-help-dialog";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
const ThroughputChart = dynamic(
  () =>
    import("@/feature/dashboard/components/throughput-chart").then(
      (module) => module.ThroughputChart,
    ),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false },
);
const CycleTimeChart = dynamic(
  () =>
    import("@/feature/dashboard/components/cycle-time-chart").then(
      (module) => module.CycleTimeChart,
    ),
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

const THROUGHPUT_TITLES: Record<Period, string> = {
  week: "Weekly throughput (this week)",
  month: "Weekly throughput (this month)",
  quarter: "Weekly throughput (this quarter)",
  year: "Weekly throughput (this year)",
};

const CYCLE_TIME_TITLES: Record<Period, string> = {
  week: "Task & Bug cycle time (this week)",
  month: "Task & Bug cycle time (this month)",
  quarter: "Task & Bug cycle time (this quarter)",
  year: "Task & Bug cycle time (this year)",
};

/** Project Manager mode backed by a compact, server-computed report. */
export default function PmPage() {
  const { project, projects, period } = useFilters();
  const projectId = project === "all" ? null : Number(project);
  const hasValidProject = projectId !== null && Number.isSafeInteger(projectId) && projectId > 0;
  const {
    report,
    receivedCount,
    totalCount,
    isComplete,
    isLoading,
    error,
  } = usePmReportStream(hasValidProject ? { projectId, period } : null);
  const projectName = projects.find((candidate) => candidate.id === projectId)?.name ?? "Selected project";
  const loading = !report && isLoading;
  // True once we have a partial report but the stream hasn't finished delivering every page yet.
  const streaming = Boolean(report) && !isComplete && !error;
  const statusActive = loading || streaming;
  const [isStatusVisible, setIsStatusVisible] = useState(statusActive);

  useEffect(() => {
    if (statusActive) {
      const timeoutId = window.setTimeout(() => setIsStatusVisible(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (!isStatusVisible) return;

    const timeoutId = window.setTimeout(() => setIsStatusVisible(false), 200);
    return () => window.clearTimeout(timeoutId);
  }, [isStatusVisible, statusActive]);

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
    <div className="pm-page relative flex flex-col gap-6" aria-busy={loading || streaming}>
      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`fixed right-0 top-20 z-50 flex max-w-sm items-center gap-3 rounded-bl-2xl rounded-tl-2xl border border-primary/30 bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg ${statusActive ? "animate-in slide-in-from-right-5 fade-in-0 duration-200" : "animate-out slide-out-to-right-5 fade-out-0 duration-200"}`}
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading {period} report…
        </div>
      ) : streaming || isStatusVisible ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`fixed right-0 top-20 z-50 flex max-w-sm items-center gap-3 rounded-bl-2xl rounded-tl-2xl border border-primary/30 bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg ${statusActive ? "animate-in slide-in-from-right-5 fade-in-0 duration-200" : "animate-out slide-out-to-right-5 fade-out-0 duration-200"}`}
        >
          <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <div>
            <span className="shrink-0">Updating project report</span>
            <p>Loading… {receivedCount.toLocaleString()} {totalCount > 0 ? ` of ${totalCount.toLocaleString()}` : ""} work packages</p>
          </div>
        </div>
      ) : null}
      {error && report ? (
        <p className="text-sm text-destructive">Refresh failed; showing partial/cached report: {error}</p>
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
          <CardAction>
            <ChartHelpDialog
              title="Task and Bug workload by assignee"
              description="Compares the Task and Bug workload assigned to each project member."
            >
              <p className="text-sm text-muted-foreground">
                Each horizontal bar represents an assignee. Its Task and Bug segments show
                the mix and total volume of work attributed to that person. Longer bars
                indicate heavier workload, but do not account for ticket size or complexity.
              </p>
            </ChartHelpDialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : <WorkloadChart data={report?.workload ?? []} />}
        </CardContent>
      </Card>

      <div className="pm-page__breakdowns grid gap-4 lg:grid-cols-2">
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

      <div className="pm-page__throughput grid gap-4 lg:grid-cols-2">
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

      <div className="pm-page__cycle-time grid gap-4 lg:grid-cols-2">
        <div>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <ThroughputChart
              title={THROUGHPUT_TITLES[period]}
              data={report?.throughput ?? []}
            />
          )}
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <CycleTimeChart
              title={CYCLE_TIME_TITLES[period]}
              data={report?.cycleTime ?? []}
            />
          )}
        </div>
      </div>

      <MemberBreakdownTable members={report?.memberStats ?? []} loading={loading} />
    </div>
  );
}
