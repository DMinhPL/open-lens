"use client";

import { useEffect, useState } from "react";
import type { ProjectManagerReport, ProjectManagerReportStreamFrame, Period } from "@/core/domain/types";

export interface PmReportStreamQuery {
  projectId: number;
  period: Period;
}

export interface PmReportStreamState {
  report: ProjectManagerReport | null;
  receivedCount: number;
  totalCount: number;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
}

type PmReportStreamStateWithQueryKey = PmReportStreamState & {
  queryKey: string | null;
};

const INITIAL_STATE: PmReportStreamStateWithQueryKey = {
  report: null,
  receivedCount: 0,
  totalCount: 0,
  isComplete: false,
  isLoading: false,
  error: null,
  queryKey: null,
};

/**
 * Client-side counterpart of `GET /api/openproject/pm-report-stream`. Uses `fetch` +
 * `ReadableStream.getReader()` (rather than `EventSource`) so the request can carry an
 * `AbortController` signal — needed to actually stop the upstream OpenProject requests when the
 * query changes or the component unmounts, which a plain `EventSource` can't do as cleanly.
 *
 * Mirrors how `pm-page.tsx` previously built its RTK Query args: pass `null` for `query` to skip
 * (equivalent to `skipToken`), or `{ projectId, period }` to (re)connect.
 */
export function usePmReportStream(query: PmReportStreamQuery | null): PmReportStreamState {
  const [state, setState] = useState<PmReportStreamStateWithQueryKey>(INITIAL_STATE);
  const projectId = query?.projectId ?? null;
  const period = query?.period ?? null;
  const queryKey = projectId !== null && period !== null ? `${projectId}:${period}` : null;

  useEffect(() => {
    if (projectId === null || period === null) {
      setState(INITIAL_STATE);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setState({ ...INITIAL_STATE, queryKey, isLoading: true });

    async function run() {
      try {
        const res = await fetch(
          `/api/openproject/pm-report-stream?projectId=${projectId}&period=${period}`,
          { signal: controller.signal },
        );

        if (!res.ok || !res.body) {
          const message = await res.text().catch(() => "Request failed");
          throw new Error(message || `Request failed with status ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const rawEvent of events) {
            if (cancelled) break;
            const isError = rawEvent.includes("event: error");
            const dataLine = rawEvent
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            const jsonText = dataLine.slice("data:".length).trim();
            if (!jsonText) continue;

            if (isError) {
              const parsed = JSON.parse(jsonText) as { error: string };
              setState((prev) => ({ ...prev, isLoading: false, error: parsed.error }));
              continue;
            }

            const parsed = JSON.parse(jsonText) as ProjectManagerReportStreamFrame;
            setState((prev) => ({
              ...prev,
              report: parsed.report ?? prev.report,
              receivedCount: parsed.receivedCount,
              totalCount: parsed.totalCount,
              isComplete: parsed.done,
              isLoading: false,
              error: parsed.done ? null : prev.error,
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

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, period]);

  // Effects run after render. Hide the previous project's values immediately while the
  // effect starts the replacement stream, so project changes cannot show stale progress.
  if (state.queryKey !== queryKey) {
    return { ...INITIAL_STATE, isLoading: queryKey !== null };
  }

  return {
    report: state.report,
    receivedCount: state.receivedCount,
    totalCount: state.totalCount,
    isComplete: state.isComplete,
    isLoading: state.isLoading,
    error: state.error,
  };
}
