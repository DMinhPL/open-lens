"use client";

/**
 * LAYER 3 — "Hook React đọc SSE từ `createSseResponse`".
 *
 * Generic version of `feature/pm/use-pm-report-stream.ts`. Uses `fetch` + `getReader()` instead of
 * `EventSource` so the request can be aborted (EventSource can't cleanly stop the upstream work).
 *
 * Usage:
 *   const s = useSseStream<MyReport>(query ? `/api/foo-stream?${params}` : null);
 *   s.data / s.receivedCount / s.totalCount / s.isComplete / s.isLoading / s.error
 *
 * Pass `null` as the URL to skip (like RTK Query's `skipToken`). The URL itself is the cache key:
 * when it changes, the previous stream is aborted and the old values are hidden immediately.
 */
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

  // Effects run after render: hide the previous URL's values right away so a changed query
  // can never flash stale progress while the new stream is starting.
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
