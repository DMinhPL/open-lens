# Progressive Paginated Stream (SSE + parallel pagination)

A self-contained guide. Copy the 4 files below into **any Next.js (App Router) + React project** and use them right away. No external dependencies.

---

## 1. What problem does this solve?

An upstream API returns a large dataset **page by page** (say 200 records per page, 5,000 in total). If you wait for every page before responding, the user stares at an empty screen for seconds, sometimes tens of seconds.

**The idea:** as soon as one page arrives, compute a partial result from what you have so far and push it to the browser immediately. The UI updates progressively, with a progress bar.

### When to use it

- The upstream API is paginated and fetching everything takes a few seconds or more.
- A partial result is meaningful on partial data (totals, counts, statistics, a growing list).

### When NOT to use it

- The result is only correct once **all** data is present (for example, a global sort). Use a plain JSON response instead.
- The upstream uses **cursor pagination** (`nextCursor`, no `total`): pages depend on each other, so they can't be fetched in parallel (see section 9).

---

## 2. Architecture: 3 independent layers

```
 Upstream API (paginated)
        │
 ┌──────▼─────────────────────────────────┐
 │ LAYER 1  paginated-fetch.ts            │  fetchAllPages()
 │ Fetch pages, N requests in parallel    │  (knows nothing about HTTP/SSE/domain)
 └──────┬─────────────────────────────────┘
        │ onChunk(newItems, received, total)
 ┌──────▼─────────────────────────────────┐
 │ LAYER 2  sse.ts  (server)              │  createSseResponse()
 │ SSE framing, abort, errors, headers    │  createThrottle(), jsonError()
 └──────┬─────────────────────────────────┘
        │  data: {...}\n\n      (contract: StreamFrame<T> in types.ts)
 ┌──────▼─────────────────────────────────┐
 │ LAYER 3  use-sse-stream.ts  (client)   │  useSseStream<T>(url | null)
 │ Read frames, update React state        │
 └────────────────────────────────────────┘
```

The layers talk to each other only through the **`StreamFrame<T>` contract**, so you can swap the API or the UI without touching the other layers.

### Runtime flow

1. A component calls `useSseStream<T>(url)`.
2. The route validates its parameters. On failure it returns a plain JSON 400 and **never opens a stream**.
3. The route opens the stream (`createSseResponse`) and runs the "producer" you write.
4. `fetchAllPages` fetches page 1, learns `total`, then N workers fetch the remaining pages.
5. Each time a page arrives, `onChunk` adds the items to an accumulator. If the throttle allows, it computes a partial result and `send`s a `done: false` frame.
6. When everything is fetched, it always `send`s one final `done: true` frame with the complete result.
7. The hook receives each frame and calls `setState`; React re-renders.

### Failure handling (built into layers 1 and 2)

| Situation | Behavior |
|---|---|
| User changes the query or leaves the page | Hook calls `abort()` → server's `request.signal` fires → in-flight upstream requests are cancelled → stream closes |
| One page fails | All workers stop immediately; the error is sent to the client as an `event: error` frame |
| Client already disconnected but the server still calls `send` | Silently ignored |
| Every case | `finally` always closes the stream, so no connection is left hanging |

---

## 3. Suggested folder layout

```
core/streaming/
├── types.ts              # StreamFrame<T> contract (shared by server + client)
├── paginated-fetch.ts    # LAYER 1
├── sse.ts                # LAYER 2 (server)
└── use-sse-stream.ts     # LAYER 3 (client, "use client")
```

> The `@/` alias is only needed in your own application code. These 4 files import each other with relative paths (`./types`).

---

## 4. Full source (copy as-is)

### 4.1 `types.ts`: the shared contract

```ts
export interface StreamFrame<TData> {
  /** Result computed from everything received so far. `null` if nothing is computable yet. */
  data: TData | null;
  /** How many records have arrived so far. */
  receivedCount: number;
  /** Total number of records (as reported by the upstream API). Drives progress bars. */
  totalCount: number;
  /** `true` only on the very last frame; `data` is then the final, complete result. */
  done: boolean;
}
```

### 4.2 `paginated-fetch.ts`: LAYER 1

```ts
export interface Page<T> {
  items: T[];
  /** Total number of records across ALL pages (not just this one). */
  total: number;
}

export interface PaginatedFetchOptions<T> {
  /**
   * Fetch one page. `page` is the number to send to the API (starts at `firstPage`).
   * Forward `signal` to `fetch` so in-flight requests can be cancelled.
   * Map raw → domain objects here so `T` is already your final type.
   */
  fetchPage: (page: number, signal: AbortSignal) => Promise<Page<T>>;
  /** Records per page. Must match what `fetchPage` asks the API for. */
  pageSize: number;
  /** Called after every page resolves, with only the newly arrived records. */
  onChunk: (newItems: T[], receivedCount: number, totalCount: number) => void | Promise<void>;
  /** Max requests in flight at once. Default 4. */
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
        // No `await` between the check and the increment, so two workers can never take the same page.
        const pageNumber = pageNumbers[cursor++];
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
```

### 4.3 `sse.ts`: LAYER 2 (server)

```ts
export interface SseContext<TFrame> {
  /** Push one frame to the client. Silently ignored once the client is gone. */
  send: (frame: TFrame) => void;
  /** Aborted when the client disconnects. Pass it to `fetchAllPages` / `fetch`. */
  signal: AbortSignal;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  // no-transform: stop proxies/compression from buffering chunks together.
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Tell Nginx not to buffer, otherwise all frames arrive in one lump at the end.
  "X-Accel-Buffering": "no",
} as const;

/** One SSE message: `data: <json>` terminated by a blank line (`\n\n`). */
function dataFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/** Error message: the `event: error` line lets the client tell it apart from normal data. */
function errorFrame(message: string): string {
  return `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`;
}

/** Plain JSON error for input validation. Return it BEFORE opening a stream. */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Opens an SSE stream and runs `producer`. Handles for you:
 *  - encoding frames, and never writing after the client has left,
 *  - sending an `event: error` frame if `producer` throws (unless the client aborted),
 *  - always closing the stream (`finally`), whether on success, error or abort.
 */
export function createSseResponse<TFrame>(
  request: Request,
  producer: (ctx: SseContext<TFrame>) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      signal.addEventListener("abort", close);

      const write = (text: string) => {
        if (closed || signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
        }
      };

      try {
        await producer({ send: (frame) => write(dataFrame(frame)), signal });
      } catch (err) {
        if (!signal.aborted) write(errorFrame(err instanceof Error ? err.message : "Stream failed"));
      } finally {
        signal.removeEventListener("abort", close);
        close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Rate limiter for expensive per-page work (e.g. recomputing a report on every page).
 * `shouldEmit()` returns `true` at most once per `intervalMs`; `shouldEmit(true)` forces it.
 */
export function createThrottle(intervalMs: number): (force?: boolean) => boolean {
  let last = 0;
  return (force = false) => {
    const now = Date.now();
    if (!force && now - last < intervalMs) return false;
    last = now;
    return true;
  };
}
```

### 4.4 `use-sse-stream.ts`: LAYER 3 (client)

```ts
"use client";

import { useEffect, useState } from "react";
import type { StreamFrame } from "./types";

export interface SseStreamState<TData> {
  data: TData | null;
  receivedCount: number;
  totalCount: number;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
}

type StateWithUrl<TData> = SseStreamState<TData> & { url: string | null };

function initialState<TData>(url: string | null, isLoading = false): StateWithUrl<TData> {
  return { data: null, receivedCount: 0, totalCount: 0, isComplete: false, isLoading, error: null, url };
}

/** Splits a text buffer into complete SSE events + the unfinished remainder. */
function splitEvents(buffer: string): { events: string[]; rest: string } {
  const events = buffer.replace(/\r\n/g, "\n").split("\n\n");
  return { events: events.slice(0, -1), rest: events[events.length - 1] ?? "" };
}

/** Extracts `{ isError, json }` from one raw SSE event, or `null` if it has no data line. */
function parseEvent(raw: string): { isError: boolean; json: string } | null {
  const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  const json = dataLine.slice("data:".length).trim();
  if (!json) return null;
  return { isError: raw.includes("event: error"), json };
}

/**
 * Pass `null` to skip (like RTK Query's `skipToken`). The URL itself is the key: when it
 * changes, the previous stream is aborted and the old values are hidden immediately.
 */
export function useSseStream<TData>(url: string | null): SseStreamState<TData> {
  const [state, setState] = useState<StateWithUrl<TData>>(() => initialState<TData>(null));

  useEffect(() => {
    if (url === null) {
      setState(initialState<TData>(null));
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState(initialState<TData>(url, true));

    async function run(target: string) {
      try {
        const res = await fetch(target, { signal: controller.signal });
        if (!res.ok || !res.body) {
          const message = await res.text().catch(() => "");
          throw new Error(message || `Request failed with status ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const { events, rest } = splitEvents(buffer);
          buffer = rest; // keep the half-received tail for the next read

          for (const raw of events) {
            if (cancelled) break;
            const evt = parseEvent(raw);
            if (!evt) continue;

            if (evt.isError) {
              const { error } = JSON.parse(evt.json) as { error: string };
              setState((prev) => ({ ...prev, isLoading: false, error }));
              continue;
            }

            const frame = JSON.parse(evt.json) as StreamFrame<TData>;
            setState((prev) => ({
              ...prev,
              data: frame.data ?? prev.data,
              receivedCount: frame.receivedCount,
              totalCount: frame.totalCount,
              isComplete: frame.done,
              isLoading: false,
              error: frame.done ? null : prev.error,
            }));
          }
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Request failed",
        }));
      }
    }

    void run(url);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  // Effects run after render: hide the previous URL's values right away so a changed
  // query can never flash stale progress while the new stream is starting.
  if (state.url !== url) return initialState<TData>(url, url !== null);

  return {
    data: state.data,
    receivedCount: state.receivedCount,
    totalCount: state.totalCount,
    isComplete: state.isComplete,
    isLoading: state.isLoading,
    error: state.error,
  };
}
```

---

## 5. Recipe for a new API (3 steps)

Example: stream a list of orders and compute revenue stats.

### Step 1: Write the route (`app/api/orders-stream/route.ts`)

```ts
import { createSseResponse, createThrottle, jsonError } from "@/core/streaming/sse";
import { fetchAllPages } from "@/core/streaming/paginated-fetch";
import type { StreamFrame } from "@/core/streaming/types";

export const dynamic = "force-dynamic"; // never cache a stream

const PAGE_SIZE = 200;

export async function GET(request: Request) {
  // 1) Validate BEFORE opening a stream
  const shopId = Number(new URL(request.url).searchParams.get("shopId"));
  if (!Number.isSafeInteger(shopId) || shopId <= 0) return jsonError("shopId is invalid");

  // 2) Open the stream; you only write "what to compute and when to send"
  return createSseResponse<StreamFrame<OrderStats>>(request, async ({ send, signal }) => {
    const orders: Order[] = [];             // accumulator
    const shouldEmit = createThrottle(300); // at most ~3 frames per second
    const build = () => computeOrderStats(orders);

    await fetchAllPages<Order>({
      pageSize: PAGE_SIZE,
      concurrency: 4,
      signal,
      fetchPage: async (page, sig) => {
        const res = await fetch(`https://api.example.com/orders?shop=${shopId}&page=${page}&size=${PAGE_SIZE}`, {
          signal: sig,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Upstream error ${res.status}`);
        const json = await res.json();
        return { items: json.rows.map(mapOrder), total: json.total };
      },
      onChunk: (newItems, received, total) => {
        orders.push(...newItems);
        if (shouldEmit()) send({ data: build(), receivedCount: received, totalCount: total, done: false });
      },
    });

    // 3) ALWAYS send a final frame: the last page may have been skipped by the throttle
    if (!signal.aborted) {
      send({ data: build(), receivedCount: orders.length, totalCount: orders.length, done: true });
    }
  });
}
```

### Step 2: Use it in a component

```tsx
"use client";
import { useSseStream } from "@/core/streaming/use-sse-stream";

export function OrdersPanel({ shopId }: { shopId: number | null }) {
  const s = useSseStream<OrderStats>(shopId ? `/api/orders-stream?shopId=${shopId}` : null);

  if (s.error) return <p>Error: {s.error}</p>;
  if (s.isLoading) return <p>Connecting...</p>;
  return (
    <>
      {!s.isComplete && <progress value={s.receivedCount} max={s.totalCount} />}
      <Stats value={s.data} />
    </>
  );
}
```

### Step 3: There is no step 3

Abort handling, errors, headers, closing the stream and SSE parsing are all in the library.

---

## 6. Checklist when applying it

- [ ] The route has `export const dynamic = "force-dynamic"` if Next.js might cache it (App Router).
- [ ] `fetchPage` **forwards `signal` to `fetch`**, otherwise in-flight requests can't be cancelled.
- [ ] `pageSize` matches the page size you request from the API (otherwise the page count is wrong).
- [ ] `firstPage` is right: is the API 1-based or 0-based?
- [ ] `total` is the total across **all** pages, not the record count of the current page.
- [ ] A final `done: true` frame is always sent.
- [ ] `onChunk` logic does not depend on page order (see section 7).
- [ ] `concurrency` is reasonable for the upstream (section 8).

---

## 7. Behavior to keep in mind

- **Pages can arrive out of order** (page 5 can finish before page 3). `onChunk` only receives new records; if you need ordering, sort in your accumulator.
- **Throttle applies to partial frames only.** The final `done: true` frame should not go through it.
- **An external abort does not throw:** `fetchAllPages` returns the data it already has. So the producer should check `signal.aborted` before sending the final frame.
- **One failing page fails the whole stream.** To tolerate per-page failures, catch inside `fetchPage` (add a retry) and return `{ items: [], total }`, but the numbers will then be incomplete.

---

## 8. Choosing `concurrency`

| Value | When |
|---|---|
| 1 | Very weak upstream, or a strict rate limit |
| **4 (default)** | A safe starting point for self-hosted APIs |
| 6–8 | Strong upstream or CDN-backed; watch for 429s and timeouts |

If you hit 429 (Too Many Requests), lower it and/or add retry with backoff inside `fetchPage`.

---

## 9. Limits and extensions

- **Cursor pagination** (no `total`, each page returns `nextCursor`): pages depend on each other, so they can't be parallelized. You need a sequential variant, for example `fetchAllByCursor({ fetchNext: (cursor) => ({ items, nextCursor }) })`, calling `onChunk` after each page. Layers 2 and 3 stay unchanged.
- **Retry/backoff:** not included. Put it inside each API's `fetchPage`.
- **Multiple sources at once** (e.g. two APIs): call several `fetchAllPages` in the same producer, sharing one accumulator and one `shouldEmit`; sum the totals manually.
- **Frameworks other than Next.js:** layers 1 and 3 work as-is. Layer 2 relies only on Web Standards (`Request`, `Response`, `ReadableStream`), so it runs on any runtime that supports them (Next.js, Remix, SvelteKit, Hono, Cloudflare Workers, Deno, Bun). Pass the `Request` to `createSseResponse` and return its `Response`.
- **Using `EventSource` instead of `fetch`:** simpler, but it can't cleanly cancel upstream work and can't send custom headers. The hook uses `fetch` + `getReader()` for that reason.

---

## 10. Quick test of Layer 1 (no server needed)

`fetchAllPages` is pure logic, so you can test it with a fake `fetchPage`:

```ts
let inflight = 0, peak = 0;
const all = await fetchAllPages<number>({
  pageSize: 100,
  concurrency: 4,
  fetchPage: async (p) => {
    inflight++; peak = Math.max(peak, inflight);
    await new Promise((r) => setTimeout(r, 20));
    inflight--;
    const from = (p - 1) * 100;
    return { items: Array.from({ length: Math.min(100, 1050 - from) }, (_, i) => from + i), total: 1050 };
  },
  onChunk: () => {},
});
// Expect: all.length === 1050, new Set(all).size === 1050, peak <= 4
```

Also test two more scenarios: (1) one page throws → the remaining requests are aborted and the promise rejects; (2) `signal` is aborted midway → it returns the data gathered so far and requests no further pages.
