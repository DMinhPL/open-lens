/**
 * LAYER 1 — "Lấy dữ liệu phân trang với số request song song có giới hạn".
 *
 * Generic version of `fetchWorkPackagesForProjectChunked`. It knows NOTHING about OpenProject,
 * HTTP or SSE: you give it a `fetchPage` function and it handles the rest.
 *
 * How it works:
 *  1. Fetch the first page → learn `total` → compute how many pages remain.
 *  2. Start up to `concurrency` workers. Each worker loops: "take next page number → fetch →
 *     report via onChunk → take the next one". A shared `cursor` hands out page numbers; because JS
 *     is single-threaded and there is no `await` between reading and incrementing it, two workers
 *     can never take the same page.
 *  3. If anything fails or the caller aborts, ALL workers stop (unlike a bare Promise.all, which
 *     would leave the other workers fetching in the background).
 *
 * Note: pages may arrive out of order (page 5 can finish before page 3). `onChunk` therefore
 * receives only the NEW items; accumulate them yourself and don't assume ordering.
 */

export interface Page<T> {
  items: T[];
  /** Total number of items across ALL pages (not just this page). */
  total: number;
}

export interface PaginatedFetchOptions<T> {
  /**
   * Fetch one page. `page` is the number you should send to the API (starts at `firstPage`).
   * Forward `signal` to `fetch` so in-flight requests are cancelled too.
   * Do the raw→domain mapping inside here so `T` is already your final type.
   */
  fetchPage: (page: number, signal: AbortSignal) => Promise<Page<T>>;
  /** Items per page — must match what `fetchPage` asks the API for. Used to compute page count. */
  pageSize: number;
  /** Called after every page resolves, with only the newly arrived items. */
  onChunk: (newItems: T[], receivedCount: number, totalCount: number) => void | Promise<void>;
  /** Max requests in flight at once. Default 4 (safe for self-hosted APIs). */
  concurrency?: number;
  /** Number of the first page. Default 1. Use 0 for zero-based APIs. */
  firstPage?: number;
  /** Abort from outside (e.g. `request.signal`). */
  signal?: AbortSignal;
}

export async function fetchAllPages<T>(options: PaginatedFetchOptions<T>): Promise<T[]> {
  const { fetchPage, pageSize, onChunk, concurrency = 4, firstPage = 1, signal } = options;

  // Internal controller: aborted when the caller aborts OR when any worker fails.
  const internal = new AbortController();
  const forwardAbort = () => internal.abort();
  if (signal?.aborted) internal.abort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });
  const inner = internal.signal;

  try {
    const first = await fetchPage(firstPage, inner);
    const total = first.total;
    const all: T[] = [...first.items];
    await onChunk(first.items, all.length, total);

    const remainingPages = Math.ceil(total / pageSize) - 1;
    if (remainingPages <= 0 || inner.aborted) return all;

    const pageNumbers = Array.from({ length: remainingPages }, (_, i) => firstPage + 1 + i);
    let cursor = 0;

    async function worker() {
      while (cursor < pageNumbers.length) {
        if (inner.aborted) return;
        const pageNumber = pageNumbers[cursor++]; // no `await` between check and increment → safe
        const page = await fetchPage(pageNumber, inner);
        if (inner.aborted) return;
        all.push(...page.items);
        await onChunk(page.items, all.length, total);
      }
    }

    const workerCount = Math.min(concurrency, pageNumbers.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        try {
          await worker();
        } catch (err) {
          internal.abort(); // one worker failed → tell the others to stop
          throw err;
        }
      }),
    );

    return all;
  } finally {
    signal?.removeEventListener("abort", forwardAbort);
  }
}
