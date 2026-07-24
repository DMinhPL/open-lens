import { NextResponse } from "next/server";
import { getStatuses } from "@/lib/openproject-client";

export async function GET() {
  try {
    const statuses = await getStatuses();
    return NextResponse.json({ statuses });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load statuses" },
      { status: 500 },
    );
  }
}
