import { NextRequest, NextResponse } from "next/server";
import { computeProjectManagerReport } from "@/core/domain/pm-report";
import type { Period } from "@/core/domain/types";
import {
  getProjectMembers,
  getStatuses,
  getWorkPackagesForProject,
} from "@/core/openproject/openproject-client";

const PERIODS = new Set<Period>(["week", "month", "quarter", "year"]);

export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    const projectIdParam = request.nextUrl.searchParams.get("projectId");
    const periodParam = request.nextUrl.searchParams.get("period") ?? "month";
    const projectId = Number(projectIdParam);

    if (!projectIdParam || !/^\d+$/.test(projectIdParam) || !Number.isSafeInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "projectId must be a positive integer" }, { status: 400 });
    }
    if (!PERIODS.has(periodParam as Period)) {
      return NextResponse.json({ error: "period must be week, month, quarter, or year" }, { status: 400 });
    }

    const fetchStartedAt = performance.now();
    const [workPackages, members, statuses] = await Promise.all([
      getWorkPackagesForProject(projectId),
      getProjectMembers(projectId),
      getStatuses(),
    ]);
    const fetchedAt = performance.now();
    const report = computeProjectManagerReport(workPackages, members, statuses, periodParam as Period);
    const completedAt = performance.now();

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        "Server-Timing": [
          `upstream;dur=${Math.round(fetchedAt - fetchStartedAt)}`,
          `aggregate;dur=${Math.round(completedAt - fetchedAt)}`,
          `total;dur=${Math.round(completedAt - startedAt)}`,
        ].join(", "),
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build PM report" },
      { status: 500 },
    );
  }
}
