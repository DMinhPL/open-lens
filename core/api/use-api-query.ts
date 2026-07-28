"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/core/api/http";

interface ApiQueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiQueryOptions {
  /**
   * Set to `false` to skip fetching — e.g. to wait for a dependency (such as a
   * user id) to be ready before calling an endpoint that needs it. Defaults to
   * `true`. Flipping this back to `true` triggers a fetch.
   */
  enabled?: boolean;
}

export interface UseApiQueryResult<T> extends ApiQueryState<T> {
  /** Re-runs the request against the current `url`, cancelling any request already in flight. */
  refresh: () => void;
}

/**
 * Fetches a same-origin JSON endpoint and tracks `{ data, loading, error }` —
 * the single hook every "component-level `useEffect` + `fetch`" call site in
 * this codebase should use instead of hand-rolling the pattern again (as
 * `app/(app)/dashboard/page.tsx` and `app/(app)/tickets/page.tsx` previously
 * did, identically, and `lib/filters-context.tsx` did a third time without
 * the cancellation handling).
 *
 * What this centralizes, versus each of those ad-hoc versions:
 * - **Cancellation**: an `AbortController` is created per request and aborted
 *   when `url`/`enabled` changes or the component unmounts, so a slow response
 *   for a stale request can never overwrite state for a newer one (the classic
 *   fetch-in-`useEffect` race condition).
 * - **Consistent errors**: messages come from {@link apiFetch}/`ApiError`
 *   instead of every caller re-deriving `data.error ?? "fallback"` itself.
 * - **Abort is not an error**: an aborted request is silently ignored rather
 *   than surfaced as `error` — it was cancelled on purpose, not failed.
 *
 * @param url - The endpoint to fetch, e.g. `"/api/openproject/work-packages?mine=true"`.
 *   Pass `null` to skip fetching entirely — combined with `enabled`, this is how
 *   you express "wait until some other piece of state is ready" (see the
 *   `useApiQuery(user ? \`/api/x/${user.id}\` : null)` shape).
 * @param options.enabled - When `false`, no request is made and `loading` is
 *   forced to `false`. Defaults to `true`.
 * @returns `data` (`null` until the first successful response), `loading`,
 *   `error`, and `refresh()` to re-run the request on demand (e.g. after a
 *   mutation elsewhere has invalidated this data).
 *
 * @example
 * const { data, loading, error } = useApiQuery<{ workPackages: WorkPackage[] }>(
 *   "/api/openproject/work-packages?mine=true",
 * );
 * const workPackages = data?.workPackages ?? [];
 */
export function useApiQuery<T>(url: string | null, options: UseApiQueryOptions = {}): UseApiQueryResult<T> {
  const { enabled = true } = options;
  const shouldFetch = enabled && url !== null;

  const [state, setState] = useState<ApiQueryState<T>>({
    data: null,
    loading: shouldFetch,
    error: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!shouldFetch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disabled/null-url branch has no external work to synchronize, only this state flip
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    apiFetch<T>(url, { signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Request failed" });
      });

    return () => controller.abort();
  }, [url, shouldFetch, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  return { ...state, refresh };
}
