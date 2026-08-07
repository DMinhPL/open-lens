import { createApi, type BaseQueryFn } from "@reduxjs/toolkit/query/react";
import { apiFetch, ApiError } from "@/core/api/http";
import type {
  OpenProjectSettings,
  ProjectManagerReport,
  ProjectManagerReportQuery,
  ProjectWorkloadResponse,
  WorkPackage,
} from "@/core/domain/types";

export interface ApiQueryError {
  status?: number;
  message: string;
}

/** A same-origin request: a plain `url` for a GET, or `{ url, method, body }` for a write. */
export interface ApiRequestArgs {
  url: string;
  method?: string;
  body?: unknown;
}

/**
 * RTK Query `baseQuery` built on the same {@link apiFetch} every other same-origin call in
 * this codebase uses, so error messages/status codes stay identical to `useApiQuery`/
 * `useApiMutation` instead of RTK Query's default `fetchBaseQuery` error shape.
 */
const apiBaseQuery: BaseQueryFn<string | ApiRequestArgs, unknown, ApiQueryError> = async (arg, api) => {
  const { url, method, body } = typeof arg === "string" ? { url: arg, method: undefined, body: undefined } : arg;
  try {
    const data = await apiFetch(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: api.signal,
    });
    return { data };
  } catch (err) {
    if (err instanceof ApiError) return { error: { status: err.status, message: err.message } };
    return { error: { message: err instanceof Error ? err.message : "Request failed" } };
  }
};

/**
 * Single RTK Query slice for OpenLens's own `/api/**` route handlers — this is the place to
 * add new same-origin GET endpoints, since it gets RTK Query's request caching/dedup and
 * tag-based invalidation for free (replacing the hand-rolled `useApiQuery` this superseded).
 *
 * `refetchOnMountOrArgChange: 30` gives every endpoint stale-while-revalidate semantics: a
 * cached response under 30s old is served as-is with no request, but a mount (or arg change)
 * against an older cache entry serves the stale value immediately while a background refetch
 * updates it — on top of the focus/reconnect refetching `setupListeners` already enables in
 * `components/redux-provider.tsx`, and the tag-based revalidation `providesTags` enables below.
 */
export const openLensApi = createApi({
  reducerPath: "openLensApi",
  baseQuery: apiBaseQuery,
  refetchOnMountOrArgChange: 30,
  tagTypes: ["WorkPackages", "Settings"],
  endpoints: (builder) => ({
    /** The signed-in user's own work packages — backs `FiltersProvider`/`useFilters()`. */
    getMyWorkPackages: builder.query<{ workPackages: WorkPackage[] }, void>({
      query: () => "/api/openproject/work-packages?mine=true",
      providesTags: ["WorkPackages"],
    }),
    /** Every work package + member for one project — backs the Workload page's team view. */
    getProjectWorkload: builder.query<ProjectWorkloadResponse, number>({
      query: (projectId) => `/api/openproject/work-packages?projectId=${projectId}`,
      providesTags: ["WorkPackages"],
    }),
    /** Compact chart-ready report for Project Manager mode. */
    getProjectManagerReport: builder.query<ProjectManagerReport, ProjectManagerReportQuery>({
      query: ({ projectId, period }) =>
        `/api/openproject/pm-report?projectId=${projectId}&period=${period}`,
      providesTags: ["WorkPackages"],
      keepUnusedDataFor: 300,
    }),
    /**
     * Connection state (hasCredentials/instanceUrl/useDummyData) — backs `useOpSettings()`.
     * Every page that calls it shares this one cached request instead of each firing its own
     * `GET /api/settings` on mount, the way the pre-RTK-Query hook did.
     */
    getSettings: builder.query<OpenProjectSettings, void>({
      query: () => "/api/settings",
      providesTags: ["Settings"],
    }),
    /** Toggles dummy-vs-live data. Invalidates `Settings` so every `useOpSettings()` subscriber refetches. */
    updateSettings: builder.mutation<{ ok: true }, { useDummyData: boolean }>({
      query: (body) => ({ url: "/api/settings", method: "PATCH", body }),
      invalidatesTags: ["Settings"],
    }),
  }),
});

export const {
  useGetMyWorkPackagesQuery,
  useGetProjectWorkloadQuery,
  useGetProjectManagerReportQuery,
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} = openLensApi;
