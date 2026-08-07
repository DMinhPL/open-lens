import type {
  MemberWorkloadStat,
  OpenProjectProjectMember,
  OpenProjectStatus,
  ProjectOverviewStats,
  WorkPackage,
} from "@/core/domain/types";
import { isClosedStatus } from "@/core/colors/status-colors";
import { getDeadlineUrgency } from "@/core/domain/work-package-filters";

/**
 * Team-wide (multi-assignee) aggregation for the Project Manager mode. Kept decoupled from
 * `core/domain/stats.ts` — which computes single-user dashboard stats — since these functions
 * fold in a `members` list to seed zero-count rows and need per-assignee grouping that the
 * single-user computations have no use for. Still reuses the same primitives those functions
 * rely on (`isClosedStatus`, `getDeadlineUrgency`) so "closed"/"overdue" stay consistent across
 * both modes.
 */

function emptyMemberStat(memberId: number, memberName: string): MemberWorkloadStat {
  return {
    memberId,
    memberName,
    taskCount: 0,
    bugCount: 0,
    openCount: 0,
    closedCount: 0,
    overdueCount: 0,
    totalCount: 0,
  };
}

function isOverdue(wp: WorkPackage, closed: boolean): boolean {
  return getDeadlineUrgency(wp.dueDate, closed, 0) === "overdue";
}

/**
 * Per-member breakdown of a project's work packages. Seeds every project member with a
 * zero-count entry first so members with no assigned work still show up, then folds in each
 * work package under its assignee's bucket (creating one on the fly, `memberId: 0`, for an
 * assignee who isn't a current project member — e.g. someone who has since left the team).
 * Sorted by total workload desc, then name.
 */
export function computeMemberWorkload(
  workPackages: WorkPackage[],
  members: OpenProjectProjectMember[],
  statuses: OpenProjectStatus[] | null | undefined,
): MemberWorkloadStat[] {
  const byName = new Map<string, MemberWorkloadStat>();
  for (const member of members) {
    byName.set(member.name, emptyMemberStat(member.id, member.name));
  }

  for (const wp of workPackages) {
    const key = wp.assignee || "Unassigned";
    const entry = byName.get(key) ?? emptyMemberStat(0, key);

    const closed = isClosedStatus(wp.statusLabel ?? wp.status, statuses);
    const type = wp.type.trim().toLowerCase();
    if (type === "task") entry.taskCount += 1;
    else if (type === "bug") entry.bugCount += 1;
    if (closed) entry.closedCount += 1;
    else {
      entry.openCount += 1;
      if (isOverdue(wp, closed)) entry.overdueCount += 1;
    }
    entry.totalCount += 1;

    byName.set(key, entry);
  }

  return Array.from(byName.values()).sort(
    (a, b) => b.totalCount - a.totalCount || a.memberName.localeCompare(b.memberName),
  );
}

/** Project-wide totals for the Project Manager mode's summary stat cards. */
export function computeProjectOverview(
  workPackages: WorkPackage[],
  members: OpenProjectProjectMember[],
  statuses: OpenProjectStatus[] | null | undefined,
): ProjectOverviewStats {
  let openCount = 0;
  let closedCount = 0;
  let overdueCount = 0;

  for (const wp of workPackages) {
    const closed = isClosedStatus(wp.statusLabel ?? wp.status, statuses);
    if (closed) {
      closedCount += 1;
    } else {
      openCount += 1;
      if (isOverdue(wp, closed)) overdueCount += 1;
    }
  }

  const totalCount = workPackages.length;
  return {
    totalCount,
    openCount,
    closedCount,
    overdueCount,
    memberCount: members.length,
    completionRate: totalCount === 0 ? 0 : Math.round((closedCount / totalCount) * 100),
  };
}
