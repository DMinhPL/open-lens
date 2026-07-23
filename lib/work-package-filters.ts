import type { Period, WorkPackage } from "@/lib/types";

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
