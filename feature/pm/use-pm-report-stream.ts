"use client";

import type { DateRange, ProjectManagerReport } from "@/core/domain/types";
import { useSseStream } from "@/core/streaming/use-sse-stream";

export interface PmReportStreamQuery {
  projectId: number;
  range: DateRange;
}

export interface PmReportStreamState {
  report: ProjectManagerReport | null;
  receivedCount: number;
  totalCount: number;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * PM-specific wrapper around the generic `useSseStream` (see `core/streaming`). Client-side
 * counterpart of `GET /api/openproject/pm-report-stream`: it only builds the URL and renames
 * `data` → `report`; reading, parsing and aborting the stream is done by the generic hook.
 *
 * Mirrors how `pm-page.tsx` previously built its RTK Query args: pass `null` for `query` to skip
 * (equivalent to `skipToken`), or `{ projectId, range }` to (re)connect.
 */
export function usePmReportStream(query: PmReportStreamQuery | null): PmReportStreamState {
  const url = query
    ? `/api/openproject/pm-report-stream?projectId=${query.projectId}&from=${query.range.from}&to=${query.range.to}`
    : null;
  const { data, ...progress } = useSseStream<ProjectManagerReport>(url);
  return { report: data, ...progress };
}
