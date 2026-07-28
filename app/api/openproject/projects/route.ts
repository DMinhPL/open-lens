import { NextRequest, NextResponse } from "next/server";
import { getProjectsForUser } from "@/core/openproject/openproject-client";

export async function GET(request: NextRequest) {
  const principal = request.nextUrl.searchParams.get("principal");
  if (!principal || Number.isNaN(Number(principal))) {
    return NextResponse.json({ error: "Query param 'principal' (user id) is required" }, { status: 400 });
  }

  try {
    const projects = await getProjectsForUser(Number(principal));
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load projects" },
      { status: 500 },
    );
  }
}
