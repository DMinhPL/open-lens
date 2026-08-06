/**
 * Public facade for OpenProject data access. Every exported function here resolves
 * connection settings once, then picks between the DUMMY implementation
 * (`openproject-dummy.ts`) and the REAL one (`openproject-api.ts`) based on
 * `useDummyData`. This file should stay a thin dispatcher — implementation logic
 * belongs in one of those two files, not here.
 */
import type {
  WorkPackage,
  OpenProjectUser,
  OpenProjectProjectSummary,
  OpenProjectProjectMember,
  OpenProjectStatus,
} from "@/core/domain/types";
import { getOpSettings, buildOpCookieOptions, INSTANCE_URL_COOKIE, API_TOKEN_COOKIE, USE_DUMMY_COOKIE } from "./openproject-settings";
import {
  getDummyWorkPackages,
  getDummyWorkPackagesForProject,
  getDummyProjectMembers,
  DUMMY_USER,
  getDummyProjectsForUser,
  DUMMY_STATUSES,
} from "./openproject-dummy";
import {
  fetchWorkPackages,
  fetchWorkPackagesForCurrentUser,
  fetchWorkPackagesForProject,
  fetchProjectMembers,
  fetchCurrentUser,
  fetchProjectsForUser,
  fetchStatuses,
} from "./openproject-api";

export { INSTANCE_URL_COOKIE, API_TOKEN_COOKIE, USE_DUMMY_COOKIE, buildOpCookieOptions, getOpSettings };

export async function getWorkPackages(): Promise<WorkPackage[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return getDummyWorkPackages();
  }

  return fetchWorkPackages(settings.instanceUrl, settings.apiToken);
}

/** Returns work packages assigned to the currently authenticated OpenProject user. */
export async function getWorkPackagesForCurrentUser(): Promise<WorkPackage[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return getDummyWorkPackages();
  }

  return fetchWorkPackagesForCurrentUser(settings.instanceUrl, settings.apiToken);
}

/** Returns all visible work packages in one project, across every assignee. */
export async function getWorkPackagesForProject(projectId: number): Promise<WorkPackage[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return getDummyWorkPackagesForProject(projectId);
  }

  return fetchWorkPackagesForProject(settings.instanceUrl, settings.apiToken, projectId);
}

/** Returns direct user members visible to the caller for one project. */
export async function getProjectMembers(projectId: number): Promise<OpenProjectProjectMember[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return getDummyProjectMembers(projectId);
  }

  return fetchProjectMembers(settings.instanceUrl, settings.apiToken, projectId);
}

/** Returns the current user, honoring the dummy-data switch just like {@link getWorkPackages}. */
export async function getCurrentUser(): Promise<OpenProjectUser> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return DUMMY_USER;
  }

  return fetchCurrentUser(settings.instanceUrl, settings.apiToken);
}

export async function getProjectsForUser(userId: number): Promise<OpenProjectProjectSummary[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return getDummyProjectsForUser();
  }

  return fetchProjectsForUser(settings.instanceUrl, settings.apiToken, userId);
}

/** Returns all work package statuses configured on the OpenProject instance. */
export async function getStatuses(): Promise<OpenProjectStatus[]> {
  const settings = await getOpSettings();

  if (settings.useDummyData || !settings.instanceUrl || !settings.apiToken) {
    return DUMMY_STATUSES;
  }

  return fetchStatuses(settings.instanceUrl, settings.apiToken);
}
