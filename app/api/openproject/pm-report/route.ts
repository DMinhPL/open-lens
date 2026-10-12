import { NextRequest, NextResponse } from "next/server";
import { computeProjectManagerReport } from "@/core/domain/pm-report";
import { parseDateRangeParams } from "@/core/domain/date-range";
import {
  getProjectMembers,
  getStatuses,
  getWorkPackagesForProject,
} from "@/core/openproject/openproject-client";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    const projectIdParam = request.nextUrl.searchParams.get("projectId");
    const range = parseDateRangeParams(request.nextUrl.searchParams);
    const projectId = Number(projectIdParam);

    if (!projectIdParam || !/^\d+$/.test(projectIdParam) || !Number.isSafeInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "projectId must be a positive integer" }, { status: 400 });
    }
    if (!range) {
      return NextResponse.json({ error: "from and to must be yyyy-MM-dd dates with from <= to" }, { status: 400 });
    }

    const fetchStartedAt = performance.now();
    const [workPackages, members, statuses] = await Promise.all([
      getWorkPackagesForProject(projectId),
      getProjectMembers(projectId),
      getStatuses(),
    ]);
    const fetchedAt = performance.now();
    const report = computeProjectManagerReport(workPackages, members, statuses, range);
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
