/**
 * REAL OpenProject API implementation. Every function here makes an authenticated
 * HTTP call against a live instance. Nothing in this file returns fixture data —
 * see `openproject-dummy.ts` for that.
 */
import type {
  WorkPackage,
  WorkPackageStatus,
  WorkPackagePriority,
  OpenProjectUser,
  OpenProjectProjectSummary,
  OpenProjectProjectMember,
  OpenProjectStatus,
} from "@/core/domain/types";

/**
 * Single point of contact for authenticated GET requests against a live OpenProject
 * instance. Centralizes Basic-auth header construction and error handling so every
 * endpoint (work packages, users, projects, ...) goes through the same path.
 */
async function openProjectGet<T>(instanceUrl: string, apiToken: string, path: string): Promise<T> {
  const auth = Buffer.from(`apikey:${apiToken}`).toString("base64");
  const res = await fetch(`${instanceUrl.replace(/\/$/, "")}${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OpenProject API request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/** Shape of every OpenProject HAL collection response (`_type: "Collection"`). */
interface HalCollection<T> {
  total: number;
  count: number;
  _embedded: { elements: T[] };
}

const PROJECT_COLLECTION_PAGE_SIZE = 200;

/** Fetches every page for project-scoped collections without changing legacy collection behavior. */
async function fetchProjectCollection<T>(
  instanceUrl: string,
  apiToken: string,
  path: string,
  filters: WorkPackageFilter[],
): Promise<T[]> {
  const elements: T[] = [];
  let offset = 1;

  while (true) {
    const params = new URLSearchParams({
      offset: String(offset),
      pageSize: String(PROJECT_COLLECTION_PAGE_SIZE),
      filters: JSON.stringify(filters),
    });
    const page = await openProjectGet<HalCollection<T>>(instanceUrl, apiToken, `${path}?${params.toString()}`);
    const pageElements = page._embedded?.elements ?? [];
    elements.push(...pageElements);

    if (pageElements.length === 0 || elements.length >= page.total) return elements;
    offset += 1;
  }
}

type WorkPackageFilter = Record<string, { operator: string; values: string[] }>;

interface RawOpenProjectWorkPackage {
  id: number;
  subject: string;
  percentageDone: number | null;
  createdAt: string;
  updatedAt: string;
  startDate?: string | null;
  dueDate?: string | null;
  customField25?: string | null;
  derivedDueDate?: string | null;
  spentTime?: string | null;
  _links: {
    type?: { title?: string };
    status?: { title?: string };
    priority?: { title?: string };
    project?: { href?: string; title?: string };
    parent?: { href?: string; title?: string };
    assignee?: { title?: string };
    author?: { title?: string };
  };
}

function mapStatus(title?: string): WorkPackageStatus {
  switch (title) {
    case "Closed":
    case "Rejected":
      return "Closed";
    case "In progress":
    case "In specification":
      return "In progress";
    case "On hold":
      return "On hold";
    default:
      return "New";
  }
}

function mapPriority(title?: string): WorkPackagePriority {
  switch (title) {
    case "Low":
      return "Low";
    case "High":
      return "High";
    case "Immediate":
      return "Immediate";
    default:
      return "Normal";
  }
}

function durationToHours(duration?: string | null): number | undefined {
  if (!duration) return undefined;

  const match = duration.match(
    /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!match) return undefined;

  const [, weeks = "0", days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return (
    Number(weeks) * 168 +
    Number(days) * 24 +
    Number(hours) +
    Number(minutes) / 60 +
    Number(seconds) / 3600
  );
}

function idFromHref(href?: string): number | undefined {
  if (!href) return undefined;

  const match = href.match(/\/(\d+)\/?(?:[?#].*)?$/);
  return match ? Number(match[1]) : undefined;
}

function mapWorkPackage(raw: RawOpenProjectWorkPackage): WorkPackage {
  const statusLabel = raw._links.status?.title;
  const priorityLabel = raw._links.priority?.title;
  const status = mapStatus(statusLabel);
  return {
    id: raw.id,
    subject: raw.subject,
    type: raw._links.type?.title ?? "Unknown",
    status,
    statusLabel: statusLabel ?? status,
    priority: mapPriority(priorityLabel),
    priorityLabel: priorityLabel ?? mapPriority(priorityLabel),
    project: raw._links.project?.title ?? "Unknown",
    projectId: idFromHref(raw._links.project?.href),
    parentId: idFromHref(raw._links.parent?.href),
    parentTitle: raw._links.parent?.title,
    assignee: raw._links.assignee?.title ?? "Unassigned",
    author: raw._links.author?.title ?? "Unknown",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    closedAt: status === "Closed" ? raw.updatedAt : undefined,
    startDate: raw.startDate ?? '',
    derivedDueDate: raw.derivedDueDate ?? '',
    dueDate: raw.dueDate ?? '',
    customField25: raw.customField25 ?? '',
    percentDone: raw.percentageDone ?? 0,
    spentHours: durationToHours(raw.spentTime),
  };
}

async function fetchWorkPackagesCollection(
  instanceUrl: string,
  apiToken: string,
  filters: WorkPackageFilter[] = [],
): Promise<WorkPackage[]> {
  const params = new URLSearchParams({
    pageSize: "200",
    filters: JSON.stringify(filters),
  });
  const json = await openProjectGet<HalCollection<RawOpenProjectWorkPackage>>(
    instanceUrl,
    apiToken,
    `/api/v3/work_packages?${params.toString()}`,
  );
  return (json._embedded?.elements ?? []).map(mapWorkPackage);
}

interface RawOpenProjectUser {
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

function mapUser(raw: RawOpenProjectUser): OpenProjectUser {
  return {
    id: raw.id,
    name: raw.name,
    login: raw.login,
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    avatar: raw.avatar,
    status: raw.status,
    admin: raw.admin,
  };
}

interface RawOpenProjectProject {
  id: number;
  identifier: string;
  name: string;
  active: boolean;
}

function mapProject(raw: RawOpenProjectProject): OpenProjectProjectSummary {
  return {
    id: raw.id,
    identifier: raw.identifier,
    name: raw.name,
    active: raw.active,
  };
}

interface RawOpenProjectStatus {
  id: number;
  name: string;
  isClosed: boolean;
  color: string | null;
  isDefault: boolean;
  position: number;
}

function mapOpenProjectStatus(raw: RawOpenProjectStatus): OpenProjectStatus {
  return {
    id: raw.id,
    name: raw.name,
    isClosed: raw.isClosed,
    color: raw.color,
    isDefault: raw.isDefault,
    position: raw.position,
  };
}

/** Fetches all work packages from the live instance (no filter). */
export async function fetchWorkPackages(instanceUrl: string, apiToken: string): Promise<WorkPackage[]> {
  return fetchWorkPackagesCollection(instanceUrl, apiToken);
}

/** Fetches work packages assigned to the currently authenticated user. */
export async function fetchWorkPackagesForCurrentUser(instanceUrl: string, apiToken: string): Promise<WorkPackage[]> {
  const currentUser = await openProjectGet<RawOpenProjectUser>(instanceUrl, apiToken, "/api/v3/users/me");
  return fetchWorkPackagesCollection(instanceUrl, apiToken, [
    {
      assignee: {
        operator: "=",
        values: [String(currentUser.id)],
      },
    },
  ]);
}

/** Fetches every visible work package in one project, regardless of assignee. */
export async function fetchWorkPackagesForProject(
  instanceUrl: string,
  apiToken: string,
  projectId: number,
): Promise<WorkPackage[]> {
  const raw = await fetchProjectCollection<RawOpenProjectWorkPackage>(instanceUrl, apiToken, "/api/v3/work_packages", [
    { project: { operator: "=", values: [String(projectId)] } },
  ]);
  return raw.map(mapWorkPackage);
}

interface RawOpenProjectMembership {
  _links: {
    principal: { href?: string; title?: string };
  };
}

/** Fetches direct user memberships for a project; group principals are deliberately excluded. */
export async function fetchProjectMembers(
  instanceUrl: string,
  apiToken: string,
  projectId: number,
): Promise<OpenProjectProjectMember[]> {
  const memberships = await fetchProjectCollection<RawOpenProjectMembership>(
    instanceUrl,
    apiToken,
    "/api/v3/memberships",
    [{ project: { operator: "=", values: [String(projectId)] } }],
  );
  const members = new Map<number, OpenProjectProjectMember>();

  for (const membership of memberships) {
    const href = membership._links.principal.href;
    if (!href?.includes("/api/v3/users/")) continue;

    const id = idFromHref(href);
    if (id === undefined) continue;
    members.set(id, { id, name: membership._links.principal.title ?? `User ${id}` });
  }

  return Array.from(members.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Fetches the currently authenticated user. */
export async function fetchCurrentUser(instanceUrl: string, apiToken: string): Promise<OpenProjectUser> {
  const raw = await openProjectGet<RawOpenProjectUser>(instanceUrl, apiToken, "/api/v3/users/me");
  return mapUser(raw);
}

/**
 * Fetches the projects a given user is a member of, using OpenProject's `principal`
 * filter on the `/projects` collection endpoint:
 * `filters=[{"principal":{"operator":"=","values":["<userId>"]}}]`
 */
export async function fetchProjectsForUser(
  instanceUrl: string,
  apiToken: string,
  userId: number,
): Promise<OpenProjectProjectSummary[]> {
  const filters = encodeURIComponent(JSON.stringify([{ principal: { operator: "=", values: [String(userId)] } }]));
  const json = await openProjectGet<HalCollection<RawOpenProjectProject>>(
    instanceUrl,
    apiToken,
    `/api/v3/projects?filters=${filters}&pageSize=200`,
  );
  return (json._embedded?.elements ?? []).map(mapProject);
}

/** Fetches all work package statuses configured on the live instance. */
export async function fetchStatuses(instanceUrl: string, apiToken: string): Promise<OpenProjectStatus[]> {
  const json = await openProjectGet<HalCollection<RawOpenProjectStatus>>(instanceUrl, apiToken, "/api/v3/statuses");
  return (json._embedded?.elements ?? []).map(mapOpenProjectStatus);
}
