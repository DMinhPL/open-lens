import { getStatusNames } from "@/core/colors/status-colors";
import { computeMemberWorkload, computeProjectOverview } from "@/core/domain/pm-stats";
import {
  computeBurnup,
  computeCumulativeFlow,
  computeMonthlyTrend,
  computeQuarterlyTrend,
  computeStatusBreakdown,
  computeTaskBugWorkload,
  computeTypeBreakdown,
  computeWeeklyTrend,
  computeYearlyTrend,
} from "@/core/domain/stats";
import type {
  OpenProjectProjectMember,
  OpenProjectStatus,
  Period,
  ProjectManagerReport,
  WorkPackage,
} from "@/core/domain/types";

/** Builds the compact read model consumed by Project Manager mode. */
export function computeProjectManagerReport(
  workPackages: WorkPackage[],
  members: OpenProjectProjectMember[],
  statuses: OpenProjectStatus[],
  period: Period,
): ProjectManagerReport {
  const trend =
    period === "week"
      ? computeWeeklyTrend(workPackages, 12)
      : period === "quarter"
        ? computeQuarterlyTrend(workPackages, 4)
        : period === "year"
          ? computeYearlyTrend(workPackages, 3)
          : computeMonthlyTrend(workPackages, 6);

  return {
    overview: computeProjectOverview(workPackages, members, statuses),
    memberStats: computeMemberWorkload(workPackages, members, statuses).filter(
      (member) => member.totalCount > 0,
    ),
    workload: computeTaskBugWorkload(
      workPackages,
      "assignee",
      members.map((member) => member.name),
    ).filter((entry) => entry.taskCount + entry.bugCount > 0),
    statusBreakdown: computeStatusBreakdown(workPackages, getStatusNames(statuses)),
    typeBreakdown: computeTypeBreakdown(workPackages),
    trend,
    burnup: computeBurnup(workPackages, period),
    cfd: computeCumulativeFlow(workPackages, period),
    generatedAt: new Date().toISOString(),
  };
}
