/**
 * Streaming counterpart of `GET /api/openproject/pm-report`. Same query params and validation as
 * that route; instead of a single JSON response, returns `text/event-stream` frames of shape
 * `ProjectManagerReportStreamFrame` (see `core/domain/types.ts`), recomputing the report on the
 * work packages accumulated so far as each upstream page resolves, so the PM page can render
 * partial numbers before every work package has arrived.
 *
 * ROLLBACK NOTE:
 * - Mechanism: purely additive — a new route file plus new exported functions in
 *   `openproject-api.ts` / `openproject-client.ts`. `pm-report/route.ts` and
 *   `work-packages/route.ts` are untouched, so the fallback (RTK Query non-streaming path) keeps
 *   working even if this route is broken.
 * - Blast radius: only `feature/pm/pm-page.tsx` consumes this route (via
 *   `feature/pm/use-pm-report-stream.ts`). No other page, route, or shared function is affected.
 * - Rollback window: revert `feature/pm/pm-page.tsx` to call `useGetProjectManagerReportQuery`
 *   again (a single-file revert) to instantly restore the old non-streaming behavior; deleting
 *   this route file and the two new exported chunked-fetch functions is safe at any time since
 *   nothing else references them.
 */
import { computeProjectManagerReport } from "@/core/domain/pm-report";
import type { Period, ProjectManagerReport, ProjectManagerReportStreamFrame, WorkPackage } from "@/core/domain/types";
import {
  getProjectMembers,
  getStatuses,
  getWorkPackagesForProjectChunked,
} from "@/core/openproject/openproject-client";

export const dynamic = "force-dynamic";

const PERIODS = new Set<Period>(["week", "month", "quarter", "year"]);
const THROTTLE_MS = 300;

function frame(data: ProjectManagerReportStreamFrame): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function errorFrame(message: string): string {
  return `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId");
  const periodParam = url.searchParams.get("period") ?? "month";
  const projectId = Number(projectIdParam);

  if (!projectIdParam || !/^\d+$/.test(projectIdParam) || !Number.isSafeInteger(projectId) || projectId <= 0) {
    return new Response(JSON.stringify({ error: "projectId must be a positive integer" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!PERIODS.has(periodParam as Period)) {
    return new Response(JSON.stringify({ error: "period must be week, month, quarter, or year" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const period = periodParam as Period;

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

      const safeEnqueue = (chunk: string) => {
        if (closed || signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      try {
        const [members, statuses] = await Promise.all([getProjectMembers(projectId), getStatuses()]);

        const accumulated: WorkPackage[] = [];
        let lastEmit = 0;

        const emitReport = (receivedCount: number, totalCount: number, force: boolean) => {
          if (signal.aborted) return;
          const now = Date.now();
          if (!force && now - lastEmit < THROTTLE_MS) return;
          lastEmit = now;
          const report: ProjectManagerReport = computeProjectManagerReport(accumulated, members, statuses, period);
          safeEnqueue(frame({ report, receivedCount, totalCount, done: false }));
        };

        await getWorkPackagesForProjectChunked(
          projectId,
          (newElements, receivedCount, totalCount) => {
            accumulated.push(...newElements);
            emitReport(receivedCount, totalCount, false);
          },
          signal,
        );

        if (!signal.aborted) {
          const finalReport = computeProjectManagerReport(accumulated, members, statuses, period);
          safeEnqueue(
            frame({ report: finalReport, receivedCount: accumulated.length, totalCount: accumulated.length, done: true }),
          );
        }
      } catch (err) {
        if (!signal.aborted) {
          safeEnqueue(errorFrame(err instanceof Error ? err.message : "Failed to build PM report"));
        }
      } finally {
        close();
      }
    },
    cancel() {
      // Client disconnected — the abort listener above already flips `closed`/stops enqueueing;
      // `getWorkPackagesForProjectChunked` checks `signal.aborted` between pages and stops fetching.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
