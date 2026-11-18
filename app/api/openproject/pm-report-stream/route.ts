/**
 * Streaming counterpart of `GET /api/openproject/pm-report`. Same query params and validation as
 * that route; instead of a single JSON response, returns `text/event-stream` frames of shape
 * `StreamFrame<ProjectManagerReport>` (see `core/streaming/types.ts`), recomputing the report on the
 * work packages accumulated so far as each upstream page resolves, so the PM page can render
 * partial numbers before every work package has arrived.
 *
 * The SSE plumbing (stream, abort, error frame, headers) lives in `core/streaming/sse.ts` and the
 * paging/concurrency in `core/streaming/paginated-fetch.ts`; this file only says WHAT to compute.
 *
 * ROLLBACK NOTE:
 * - Mechanism: `pm-report/route.ts` and `work-packages/route.ts` are untouched, so the fallback
 *   (RTK Query non-streaming path) keeps working even if this route is broken.
 * - Blast radius: only `feature/pm/pm-page.tsx` consumes this route (via
 *   `feature/pm/use-pm-report-stream.ts`). No other page or route is affected.
 * - Rollback window: revert `feature/pm/pm-page.tsx` to call `useGetProjectManagerReportQuery`
 *   again (a single-file revert) to instantly restore the old non-streaming behavior.
 */
import { parseDateRangeParams } from "@/core/domain/date-range";
import { computeProjectManagerReport } from "@/core/domain/pm-report";
import type { ProjectManagerReport, WorkPackage } from "@/core/domain/types";
import {
  getProjectMembers,
  getStatuses,
  getWorkPackagesForProjectChunked,
} from "@/core/openproject/openproject-client";
import { createSseResponse, createThrottle, jsonError } from "@/core/streaming/sse";
import type { StreamFrame } from "@/core/streaming/types";

export const dynamic = "force-dynamic";

const THROTTLE_MS = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId");
  const range = parseDateRangeParams(url.searchParams);
  const projectId = Number(projectIdParam);

  if (!projectIdParam || !/^\d+$/.test(projectIdParam) || !Number.isSafeInteger(projectId) || projectId <= 0) {
    return jsonError("projectId must be a positive integer");
  }
  if (!range) {
    return jsonError("from and to must be yyyy-MM-dd dates with from <= to");
  }

  return createSseResponse<StreamFrame<ProjectManagerReport>>(request, async ({ send, signal }) => {
    const [members, statuses] = await Promise.all([getProjectMembers(projectId), getStatuses()]);

    const accumulated: WorkPackage[] = [];
    const shouldEmit = createThrottle(THROTTLE_MS);
    const buildReport = () => computeProjectManagerReport(accumulated, members, statuses, range);

    await getWorkPackagesForProjectChunked(
      projectId,
      (newElements, receivedCount, totalCount) => {
        accumulated.push(...newElements);
        if (shouldEmit()) send({ data: buildReport(), receivedCount, totalCount, done: false });
      },
      signal,
    );

    // Always send a final, complete frame: the last page may have been skipped by the throttle.
    if (!signal.aborted) {
      send({ data: buildReport(), receivedCount: accumulated.length, totalCount: accumulated.length, done: true });
    }
  });
}
