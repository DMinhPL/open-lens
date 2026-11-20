/**
 * LAYER 2 — "Đóng gói thành SSE (Server-Sent Events) cho Next.js route handler".
 *
 * Generic version of the plumbing in `pm-report-stream/route.ts`: ReadableStream, TextEncoder,
 * `closed` flag, abort handling, error frame, `finally { close() }`, and the SSE headers.
 * You only write the "producer" — what to compute and when to `send`.
 */

/** Context handed to your producer. */
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
  // Tell Nginx not to buffer, otherwise frames arrive in one lump at the end.
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

/** Plain JSON error for validation failures — return BEFORE opening a stream. */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Opens an SSE stream and runs `producer`. Handles for you:
 *  - encoding frames, never enqueueing after the client left,
 *  - sending an `event: error` frame if `producer` throws (unless the client aborted),
 *  - always closing the stream (`finally`), whether success, error or abort.
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
 * Rate limiter for expensive per-chunk work (e.g. recomputing a report on every page).
 * Returns a function: call `shouldEmit()` → `true` at most once per `intervalMs`.
 * `shouldEmit(true)` forces it (use for the final frame).
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
