import { cookies } from "next/headers";
import dummyWorkPackages from "@/data/dummy-work-packages.json";
import type {
  WorkPackage,
  WorkPackageStatus,
  WorkPackagePriority,
  OpenProjectUser,
  OpenProjectProjectSummary,
} from "@/lib/types";

export const INSTANCE_URL_COOKIE = "op_instance_url";
export const API_TOKEN_COOKIE = "op_api_token";
export const USE_DUMMY_COOKIE = "op_use_dummy";

interface OpSettings {
  instanceUrl: string | null;
  apiToken: string | null;
  useDummyData: boolean;
}

export async function getOpSettings(): Promise<OpSettings> {
  const store = await cookies();
  const instanceUrl = store.get(INSTANCE_URL_COOKIE)?.value ?? null;
  const apiToken = store.get(API_TOKEN_COOKIE)?.value ?? null;
  const dummyCookie = store.get(USE_DUMMY_COOKIE)?.value;

  const envDefault = process.env.USE_DUMMY_DATA !== "false";
  const useDummyData = dummyCookie ? dummyCookie === "1" : envDefault || !instanceUrl || !apiToken;

  return { instanceUrl, apiToken, useDummyData };
}

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

interface RawOpenProjectWorkPackage {
  id: number;
  subject: string;
  percentageDone: number;
  createdAt: string;
  updatedAt: string;
  _links: {
    status?: { title?: string };
    priority?: { title?: string };
    project?: { title?: string };
    assignee?: { title?: string };
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

function mapWorkPackage(raw: RawOpenProjectWorkPackage): WorkPackage {
  const status = mapStatus(raw._links.status?.title);
  return {
    id: raw.id,
    subject: raw.subject,
    status,
    priority: mapPriority(raw._links.priority?.title),
    project: raw._links.project?.title ?? "Unknown",
    assignee: raw._links.assignee?.title ?? "Unassigned",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    closedAt: status === "Closed" ? raw.updatedAt : undefined,
    percentDone: raw.percentageDone,
  };
}

/** Shape of every OpenProject HAL collection response (`_type: "Collection"`). */
interface HalCollection<T> {
  total: number;
  count: number;
  _embedded: { elements: T[] };
}

async function fetchFromOpenProject(instanceUrl: string, apiToken: string): Promise<WorkPackage[]> {
  const json = await openProjectGet<HalCollection<RawOpenProjectWorkPackage>>(
    instanceUrl,
    apiToken,
    "/api/v3/work_packages?pageSize=200",
  );
  return (json._embedded?.elements ?? []).map(mapWorkPackage);
}

export async function getWorkPackages(): Promise<WorkPackage[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return dummyWorkPackages as WorkPackage[];
  }

  return fetchFromOpenProject(settings.instanceUrl, settings.apiToken);
}

const DUMMY_USER: OpenProjectUser = {
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

/** Returns the current user, honoring the dummy-data switch just like {@link getWorkPackages}. */
export async function getCurrentUser(): Promise<OpenProjectUser> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return DUMMY_USER;
  }

  const raw = await openProjectGet<RawOpenProjectUser>(settings.instanceUrl, settings.apiToken, "/api/v3/users/me");
  return mapUser(raw);
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

function dummyProjectsForUser(): OpenProjectProjectSummary[] {
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

/**
 * Returns the projects a given user is a member of, using OpenProject's `principal`
 * filter on the `/projects` collection endpoint:
 * `filters=[{"principal":{"operator":"=","values":["<userId>"]}}]`
 */
export async function getProjectsForUser(userId: number): Promise<OpenProjectProjectSummary[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return dummyProjectsForUser();
  }

  const filters = encodeURIComponent(JSON.stringify([{ principal: { operator: "=", values: [String(userId)] } }]));
  const json = await openProjectGet<HalCollection<RawOpenProjectProject>>(
    settings.instanceUrl,
    settings.apiToken,
    `/api/v3/projects?filters=${filters}&pageSize=200`,
  );
  return (json._embedded?.elements ?? []).map(mapProject);
}
