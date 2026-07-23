/** Fallback OpenProject instance used to build links when no instance URL is configured yet (e.g. dummy-data mode). */
export const DEFAULT_OPENPROJECT_URL = "https://proj.mecury.com.vn";

/** Builds the URL to a project's page on the actual OpenProject instance. */
export function getProjectUrl(instanceUrl: string | null | undefined, identifier: string): string {
  const base = (instanceUrl || DEFAULT_OPENPROJECT_URL).replace(/\/$/, "");
  return `${base}/projects/${identifier}`;
}

/** Builds the browser URL for a work package on the actual OpenProject instance. */
export function getWorkPackageUrl(instanceUrl: string | null | undefined, id: number): string {
  const base = (instanceUrl || DEFAULT_OPENPROJECT_URL).replace(/\/$/, "");
  return `${base}/work_packages/${id}`;
}
