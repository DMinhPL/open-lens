import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/openproject/openproject-client";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load current user" },
      { status: 500 },
    );
  }
}
