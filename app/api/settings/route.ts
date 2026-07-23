import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOpSettings, USE_DUMMY_COOKIE } from "@/lib/openproject-client";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET() {
  const settings = await getOpSettings();
  return NextResponse.json({
    hasCredentials: Boolean(settings.instanceUrl && settings.apiToken),
    instanceUrl: settings.instanceUrl,
    useDummyData: settings.useDummyData,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const store = await cookies();

  if (typeof body.useDummyData === "boolean") {
    store.set(USE_DUMMY_COOKIE, body.useDummyData ? "1" : "0", {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
    });
  }

  return NextResponse.json({ ok: true });
}
