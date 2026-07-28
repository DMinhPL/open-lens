import { NextRequest, NextResponse } from "next/server";
import { getWorkPackages, getWorkPackagesForCurrentUser } from "@/core/openproject/openproject-client";
import { filterWorkPackagesByQuery } from "@/core/domain/work-package-filters";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const workPackages =
      params.get("mine") === "true" ? await getWorkPackagesForCurrentUser() : await getWorkPackages();

    const filtered = filterWorkPackagesByQuery(workPackages, {
      status: params.get("status"),
      priority: params.get("priority"),
      project: params.get("project"),
      assignee: params.get("assignee"),
    });

    return NextResponse.json({ workPackages: filtered });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load work packages" },
      { status: 500 },
    );
  }
}
