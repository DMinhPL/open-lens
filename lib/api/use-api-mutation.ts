"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api/http";

export interface UseApiMutationOptions {
  /** HTTP method to use. Defaults to `"POST"`. */
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
}

export interface UseApiMutationResult<TInput, TOutput> {
  /** Runs the mutation once. Resolves with the parsed response, or rejects with {@link ApiError}. */
  mutate: (input?: TInput) => Promise<TOutput>;
  loading: boolean;
  /** Message from the most recently failed call, or `null`. Cleared at the start of the next call. */
  error: string | null;
}

/**
 * Wraps a non-GET request (create/update/delete) with the same loading/error
 * bookkeeping {@link useApiQuery} provides for reads, on top of the same
 * {@link apiFetch} client.
 *
 * This exists because several mutation call sites in this codebase
 * (`app/(app)/settings/page.tsx`'s `handleClearToken` and `handleToggleDummy`,
 * specifically) call `fetch()` directly and never check `res.ok` — a failed
 * request is silently treated as a success. `mutate()` here always throws on
 * a non-2xx response, so a caller that forgets to handle the rejection gets a
 * visible unhandled-rejection instead of a UI that lies about what happened.
 *
 * @param url - The endpoint to call, or a function of the mutation input that
 *   returns the endpoint — useful for routes with a path/query parameter
 *   (e.g. `(userId) => \`/api/openproject/projects?principal=${userId}\``).
 * @param options.method - HTTP method to send. Defaults to `"POST"`.
 * @returns `{ mutate, loading, error }`. `mutate(input)` JSON-encodes `input`
 *   as the request body (omitted entirely when `input` is `undefined`, e.g. a
 *   bodyless `DELETE`) and resolves with the parsed response body.
 *
 * @example
 * const { mutate: saveToken, loading, error } = useApiMutation<
 *   { instanceUrl: string; apiToken: string },
 *   { ok: true }
 * >("/api/login");
 *
 * async function handleSave() {
 *   try {
 *     await saveToken({ instanceUrl, apiToken });
 *     toast.success("Token saved");
 *   } catch (err) {
 *     toast.error(err instanceof Error ? err.message : "Failed to save token");
 *   }
 * }
 */
export function useApiMutation<TInput = void, TOutput = unknown>(
  url: string | ((input: TInput) => string),
  options: UseApiMutationOptions = {},
): UseApiMutationResult<TInput, TOutput> {
  const { method = "POST" } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (input?: TInput) => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = typeof url === "function" ? url(input as TInput) : url;
        return await apiFetch<TOutput>(endpoint, {
          method,
          body: input === undefined ? undefined : JSON.stringify(input),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [url, method],
  );

  return { mutate, loading, error };
}
