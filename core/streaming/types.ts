/**
 * Shared wire format for every progressive ("streamed") paginated endpoint.
 *
 * Server (`createSseResponse`) and client (`useSseStream`) both import this, so the two sides can
 * never drift apart. `TData` is whatever you want to show progressively (a report, a list, a map…).
 */
export interface StreamFrame<TData> {
  /** Result computed from everything received so far. `null` if nothing is computable yet. */
  data: TData | null;
  /** How many items have arrived so far. */
  receivedCount: number;
  /** How many items exist in total (as reported by the upstream API). Drives progress bars. */
  totalCount: number;
  /** `true` only on the very last frame — `data` is then the final, complete result. */
  done: boolean;
}
