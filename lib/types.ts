export type WorkPackageStatus = "New" | "In progress" | "Closed" | "On hold";

export type WorkPackagePriority = "Low" | "Normal" | "High" | "Immediate";

export interface WorkPackage {
  id: number;
  subject: string;
  status: WorkPackageStatus;
  priority: WorkPackagePriority;
  project: string;
  assignee: string;
  author: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  closedAt?: string; // ISO date, present if status is Closed
  startDate?: string; // ISO date, from OpenProject's `startDate`
  derivedDueDate?: string; // ISO date, from OpenProject's `derivedDueDate`
  percentDone: number; // 0-100
  spentHours: number; // total logged time in hours, from OpenProject's `spentTime` duration
}

export type Period = "week" | "month" | "quarter";

export interface TrendPoint {
  label: string;
  periodStart: string; // ISO date
  completed: number;
}

export interface StatusBreakdown {
  status: WorkPackageStatus;
  count: number;
}

export interface WorkloadEntry {
  key: string; // assignee, priority, or project name
  count: number;
}

export interface DashboardStats {
  completedThisWeek: number;
  completedThisMonth: number;
  completedThisQuarter: number;
  openCount: number;
  trend: TrendPoint[];
  statusBreakdown: StatusBreakdown[];
  recent: WorkPackage[];
}

export type WorkloadGroupBy = "assignee" | "priority" | "project";

/**
 * Trimmed-down view of OpenProject's `UserModel` (see spec.json.json →
 * components.schemas.UserModel). Only the fields OpenLens actually reads.
 */
export interface OpenProjectUser {
  id: number;
  name: string;
  login: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatar: string | null;
  status: string;
  admin: boolean;
}

/**
 * Trimmed-down view of OpenProject's `ProjectModel` (see spec.json.json →
 * components.schemas.ProjectModel).
 */
export interface OpenProjectProjectSummary {
  id: number;
  identifier: string;
  name: string;
  active: boolean;
}

/** Response shape of `GET /api/settings` — shared between any page that needs to
 * know the connection state (Settings page, Projects page, ...). */
export interface OpenProjectSettings {
  hasCredentials: boolean;
  instanceUrl: string | null;
  useDummyData: boolean;
}
