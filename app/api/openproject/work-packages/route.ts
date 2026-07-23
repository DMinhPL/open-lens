import { NextRequest, NextResponse } from "next/server";
import { getWorkPackages } from "@/lib/openproject-client";

export async function GET(request: NextRequest) {
  try {
    const workPackages = await getWorkPackages();
    const params = request.nextUrl.searchParams;

    const status = params.get("status");
    const priority = params.get("priority");
    const project = params.get("project");
    const assignee = params.get("assignee");

    const filtered = workPackages.filter((wp) => {
      if (status && wp.status !== status) return false;
      if (priority && wp.priority !== priority) return false;
      if (project && wp.project !== project) return false;
      if (assignee && wp.assignee !== assignee) return false;
      return true;
    });

    return NextResponse.json({ workPackages: filtered });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load work packages" },
      { status: 500 },
    );
  }
}
