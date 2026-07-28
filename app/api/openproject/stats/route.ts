import { NextResponse } from "next/server";
import { getWorkPackages } from "@/core/openproject/openproject-client";
import { computeDashboardStats } from "@/core/domain/stats";

export async function GET() {
  try {
    const workPackages = await getWorkPackages();
    const stats = computeDashboardStats(workPackages);
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute stats" },
      { status: 500 },
    );
  }
}
