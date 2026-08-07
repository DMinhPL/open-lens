"use client";

import { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useFilters } from "@/core/filters-context";
import { useGetProjectWorkloadQuery } from "@/core/api/api-slice";
import { useAppSelector } from "@/core/store/hooks";
import { computeTaskBugWorkload } from "@/core/domain/stats";
import { isClosedStatus } from "@/core/colors/status-colors";
import { WorkloadChart } from "@/components/dashboard/workload-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkloadGroupBy } from "@/core/domain/types";

const GROUP_OPTIONS: { value: WorkloadGroupBy; label: string }[] = [
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "project", label: "Project" },
];

export default function WorkloadPage() {
  const { project, projects } = useFilters();
  const statuses = useAppSelector((state) => state.common.statuses);
  const [groupBy, setGroupBy] = useState<WorkloadGroupBy>("assignee");
  const projectId = project === "all" ? null : Number(project);
  const hasValidProject = projectId !== null && Number.isSafeInteger(projectId) && projectId > 0;
  const {
    data,
    isFetching: loading,
    error: queryError,
  } = useGetProjectWorkloadQuery(hasValidProject ? projectId : skipToken);
  const error = queryError ? (queryError as { message?: string }).message ?? "Request failed" : null;
  const workPackages = useMemo(() => data?.workPackages ?? [], [data]);
  const members = useMemo(() => data?.members ?? [], [data]);
  const projectName = projects.find((candidate) => candidate.id === projectId)?.name ?? "Selected project";

  const openOnly = useMemo(
    () => workPackages.filter((wp) => !isClosedStatus(wp.statusLabel ?? wp.status, statuses)),
    [workPackages, statuses],
  );
  const workload = useMemo(
    () =>
      computeTaskBugWorkload(
        openOnly,
        groupBy,
        groupBy === "assignee" ? members.map((member) => member.name) : [],
      ).filter((entry) => entry.taskCount + entry.bugCount > 0),
    [openOnly, groupBy, members],
  );

  if (!hasValidProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Team workload</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Select a specific project from the top bar to view workload for its full team.
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Open Task and Bug workload for {projectName} by{" "}
            {GROUP_OPTIONS.find((g) => g.value === groupBy)?.label.toLowerCase()}
          </CardTitle>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as WorkloadGroupBy)}>
            <TabsList>
              {GROUP_OPTIONS.map((g) => (
                <TabsTrigger key={g.value} value={g.value}>
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : <WorkloadChart data={workload} />}
        </CardContent>
      </Card>
    </div>
  );
}
