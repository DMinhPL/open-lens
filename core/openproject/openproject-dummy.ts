/**
 * DUMMY OpenProject implementation. Everything here returns static/fixture data —
 * used when no instance is configured, or the dummy-data switch is on. See
 * `openproject-api.ts` for the real, network-backed equivalents.
 */
import dummyWorkPackages from "@/data/dummy-work-packages.json";
import type {
  WorkPackage,
  OpenProjectUser,
  OpenProjectProjectSummary,
  OpenProjectStatus,
} from "@/core/domain/types";

/** Dummy work packages, used for both `getWorkPackages` and `getWorkPackagesForCurrentUser`. */
export function getDummyWorkPackages(): WorkPackage[] {
  type DummyWorkPackage = Partial<WorkPackage> &
    Pick<
      WorkPackage,
      | "id"
      | "subject"
      | "status"
      | "priority"
      | "project"
      | "assignee"
      | "createdAt"
      | "updatedAt"
      | "percentDone"
    >;

  const projectNames = Array.from(
    new Set((dummyWorkPackages as DummyWorkPackage[]).map((workPackage) => workPackage.project)),
  ).sort((a, b) => a.localeCompare(b));

  const subjectById = new Map(
    (dummyWorkPackages as DummyWorkPackage[]).map((workPackage) => [workPackage.id, workPackage.subject]),
  );

  return (dummyWorkPackages as DummyWorkPackage[]).map((workPackage) => ({
    ...workPackage,
    projectId: workPackage.projectId ?? projectNames.indexOf(workPackage.project) + 1,
    type: workPackage.type ?? "Task",
    statusLabel: workPackage.statusLabel ?? workPackage.status,
    priorityLabel: workPackage.priorityLabel ?? workPackage.priority,
    author: workPackage.author ?? workPackage.assignee,
    spentHours: workPackage.spentHours ?? 0,
    parentTitle: workPackage.parentId
      ? workPackage.parentTitle ?? subjectById.get(workPackage.parentId) ?? "Unknown ticket"
      : undefined,
  }));
}

export const DUMMY_USER: OpenProjectUser = {
  id: 1,
  name: "Demo User",
  login: "demo",
  firstName: "Demo",
  lastName: "User",
  email: "demo@openlens.local",
  avatar: null,
  status: "active",
  admin: false,
};

/** Dummy projects, derived from the same fixture used by {@link getDummyWorkPackages}. */
export function getDummyProjectsForUser(): OpenProjectProjectSummary[] {
  const names = Array.from(new Set((dummyWorkPackages as WorkPackage[]).map((wp) => wp.project))).sort((a, b) =>
    a.localeCompare(b),
  );
  return names.map((name, index) => ({
    id: index + 1,
    identifier: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    active: true,
  }));
}

export const DUMMY_STATUSES: OpenProjectStatus[] = [
  { id: 1, name: "New", isClosed: false, color: "#3997AD", isDefault: true, position: 1 },
  { id: 2, name: "In progress", isClosed: false, color: "#3852C6", isDefault: false, position: 2 },
  { id: 3, name: "On hold", isClosed: false, color: "#A96FFE", isDefault: false, position: 3 },
  { id: 4, name: "Closed", isClosed: true, color: "#DF6DA1", isDefault: false, position: 4 },
  { id: 5, name: "Rejected", isClosed: true, color: "#D32937", isDefault: false, position: 5 },
];
