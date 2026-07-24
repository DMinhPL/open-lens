"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { WorkPackagePriority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/lib/store/hooks";
import { buildStatusColorMap, getStatusBadgeStyle } from "@/lib/status-colors";

const PRIORITY_STYLES: Record<WorkPackagePriority, string> = {
  Low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Normal: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  High: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  Immediate: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const statuses = useAppSelector((state) => state.common.statuses);
  const colorMap = useMemo(() => buildStatusColorMap(statuses), [statuses]);
  const style = useMemo(() => getStatusBadgeStyle(status, colorMap), [status, colorMap]);

  return (
    <Badge variant="outline" className="border" style={style}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: Readonly<{ priority: WorkPackagePriority }>) {
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", PRIORITY_STYLES[priority])}>
      {priority}
    </Badge>
  );
}
