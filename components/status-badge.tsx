import { Badge } from "@/components/ui/badge";
import type { WorkPackagePriority, WorkPackageStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<WorkPackageStatus, string> = {
  New: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "In progress": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "On hold": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

const PRIORITY_STYLES: Record<WorkPackagePriority, string> = {
  Low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Normal: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  High: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  Immediate: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status }: { status: WorkPackageStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: WorkPackagePriority }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", PRIORITY_STYLES[priority])}>
      {priority}
    </Badge>
  );
}
