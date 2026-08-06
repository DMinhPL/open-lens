"use client";

import { useGetSettingsQuery } from "@/core/api/api-slice";

/**
 * Single point of contact for `GET /api/settings`. Any page that needs to know the
 * connection state (hasCredentials, instanceUrl, useDummyData) should use this instead of
 * duplicating the fetch — backed by RTK Query's shared cache, so the 6+ pages calling this
 * hook dedupe into one request/subscription instead of each firing its own fetch on mount,
 * plus get stale-while-revalidate refetching (see `core/api/api-slice.ts`) for free.
 *
 * There's no `setSettings` here anymore — writes go through `useUpdateSettingsMutation`
 * (`core/api/api-slice.ts`), which invalidates the `Settings` tag so every subscriber of this
 * hook picks up the change automatically instead of each caller patching local state by hand.
 */
export function useOpSettings() {
  const { data: settings, isFetching: loading, error: queryError, refetch: refresh } = useGetSettingsQuery();
  const error = queryError ? ((queryError as { message?: string }).message ?? "Request failed") : null;

  return { settings: settings ?? null, loading, error, refresh };
}
