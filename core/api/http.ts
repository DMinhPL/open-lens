/**
 * Centralized HTTP client for client-side calls to OpenLens's own Next.js API
 * routes (the route handlers under `app/api/**`). This is scoped to same-origin
 * JSON endpoints only — it is NOT a client for the external OpenProject REST API.
 * That traffic is proxied server-side exclusively (see `lib/openproject-client.ts`)
 * and never touches the browser; the API token cookie is httpOnly precisely so
 * this file has no way to reach it.
 *
 * This replaces what was previously copy-pasted at every call site:
 * - JSON request/response handling (`Content-Type` header, `res.json()`)
 * - A single error shape (`ApiError`) instead of every caller inventing its own
 *   `if (!res.ok) { ... data.error ?? "..." }` branch
 * - A place to thread an `AbortSignal` through so requests can be cancelled
 */

/**
 * Error thrown by {@link apiFetch} for any non-2xx response.
 *
 * Every route under `app/api/**` in this project returns either the requested
 * payload or `{ error: string }` on failure — `ApiError.message` is that string
 * when present, falling back to the response's status text.
 */
export class ApiError extends Error {
  /** The HTTP status code of the failed response. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetches `input` and parses the response as JSON, throwing {@link ApiError} for
 * any non-2xx status instead of letting callers re-derive that check themselves.
 *
 * @param input - A same-origin path, e.g. `"/api/openproject/work-packages"`.
 * @param init - Standard `fetch` options.
 *   - If `init.body` is set, `Content-Type: application/json` is added automatically
 *     (override via `init.headers` if you need something else).
 *   - Pass `init.signal` to make the request cancellable — {@link useApiQuery}
 *     does this for you automatically.
 * @returns The parsed JSON response body, typed as `T`. Resolves to `null as T`
 *   for responses with no JSON body (e.g. a `204 No Content`).
 * @throws {ApiError} If the response status is not in the 200–299 range.
 * @throws {DOMException} With `name: "AbortError"` if `init.signal` was aborted
 *   before the request completed — this is not a failure, it's an intentional
 *   cancellation, and callers driving this from an effect should treat it as a
 *   no-op (see {@link useApiQuery}, which already does this).
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers;
  const res = await fetch(input, { ...init, headers });

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : res.statusText || `Request to ${input} failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}
