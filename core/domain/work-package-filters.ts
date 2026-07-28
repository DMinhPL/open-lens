import type { Period, WorkPackage } from "@/core/domain/types";

export type ReleaseDevUrgency = "overdue" | "soon" | null;

const RELEASE_DEV_WARNING_DAYS = Number(process.env.NEXT_PUBLIC_RELEASE_DEV_WARNING_DAYS) || 2;

/** Flags a ticket whose Release Dev date (customField25) is overdue or within the warning window, unless it's already done. */
export function getReleaseDevUrgency(workPackage: WorkPackage, now = new Date()): ReleaseDevUrgency {
  if (!workPackage.customField25 || workPackage.percentDone >= 100) return null;

  const deadline = new Date(`${workPackage.customField25}T00:00:00Z`);
  if (Number.isNaN(deadline.getTime())) return null;

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = Math.round((deadline.getTime() - todayUtc) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= RELEASE_DEV_WARNING_DAYS) return "soon";
  return null;
}

export function getReleaseDevRowClassName(urgency: ReleaseDevUrgency) {
  if (urgency === "overdue") return "bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-950/70";
  if (urgency === "soon") return "bg-red-300 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-950/70";
  return undefined;
}

export function getReleaseDevCellClassName(urgency: ReleaseDevUrgency) {
  return urgency ? "font-semibold text-red-700 dark:text-red-400" : undefined;
}

export function getReleaseDevUrgencyLabel(urgency: ReleaseDevUrgency) {
  if (urgency === "overdue") return " — Release Dev date overdue";
  if (urgency === "soon") return " — Release Dev date approaching";
  return "";
}

export function matchesProject(workPackage: WorkPackage, selectedProject: string) {
  if (selectedProject === "all") return true;

  return workPackage.projectId === undefined
    ? workPackage.project === selectedProject
    : String(workPackage.projectId) === selectedProject;
}

function getPeriodStart(period: Period, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "week") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  } else if (period === "month") {
    start.setDate(1);
  } else {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  }

  return start;
}

export function wasCreatedInPeriod(createdAt: string, period: Period, now = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  return created >= getPeriodStart(period, now) && created <= now;
}

export interface WorkPackageQueryFilters {
  status?: string | null;
  priority?: string | null;
  project?: string | null;
  assignee?: string | null;
}

/** Applies status/priority/project/assignee equality filters from query params, e.g. `?status=New&assignee=...`. */
export function filterWorkPackagesByQuery(
  workPackages: WorkPackage[],
  filters: WorkPackageQueryFilters,
): WorkPackage[] {
  return workPackages.filter((wp) => {
    if (filters.status && wp.status !== filters.status) return false;
    if (filters.priority && wp.priority !== filters.priority) return false;
    if (filters.project && wp.project !== filters.project) return false;
    if (filters.assignee && wp.assignee !== filters.assignee) return false;
    return true;
  });
}
