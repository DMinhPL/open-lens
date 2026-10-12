import { getStatusNames } from "@/core/colors/status-colors";
import { computeMemberWorkload, computeProjectOverview } from "@/core/domain/pm-stats";
import {
  computeBurnup,
  computeCumulativeFlow,
  computeCycleTime,
  computeStatusBreakdown,
  computeTaskBugWorkload,
  computeTrend,
  computeTypeBreakdown,
  computeWeeklyThroughput,
} from "@/core/domain/stats";
import type {
  DateRange,
  OpenProjectProjectMember,
  OpenProjectStatus,
  ProjectManagerReport,
  WorkPackage,
} from "@/core/domain/types";

/** Builds the compact read model consumed by Project Manager mode. */
export function computeProjectManagerReport(
  workPackages: WorkPackage[],
  members: OpenProjectProjectMember[],
  statuses: OpenProjectStatus[],
  range: DateRange,
): ProjectManagerReport {
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
    trend: computeTrend(workPackages, range),
    burnup: computeBurnup(workPackages, range),
    cfd: computeCumulativeFlow(workPackages, range),
    throughput: computeWeeklyThroughput(workPackages, range),
    cycleTime: computeCycleTime(workPackages, range),
    generatedAt: new Date().toISOString(),
  };
}
