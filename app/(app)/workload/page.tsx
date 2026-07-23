"use client";

import { useMemo, useState } from "react";
import { useFilters } from "@/lib/filters-context";
import { computeWorkload } from "@/lib/stats";
import { WorkloadChart } from "@/components/dashboard/workload-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkloadGroupBy } from "@/lib/types";

const GROUP_OPTIONS: { value: WorkloadGroupBy; label: string }[] = [
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "project", label: "Project" },
];

export default function WorkloadPage() {
  const { workPackages, loading, error } = useFilters();
  const [groupBy, setGroupBy] = useState<WorkloadGroupBy>("assignee");

  const openOnly = useMemo(() => workPackages.filter((wp) => wp.status !== "Closed"), [workPackages]);
  const workload = useMemo(() => computeWorkload(openOnly, groupBy), [openOnly, groupBy]);

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Open workload by {GROUP_OPTIONS.find((g) => g.value === groupBy)?.label.toLowerCase()}
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
