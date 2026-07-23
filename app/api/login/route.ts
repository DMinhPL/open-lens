import { NextRequest, NextResponse } from "next/server";
import { API_TOKEN_COOKIE, INSTANCE_URL_COOKIE, USE_DUMMY_COOKIE } from "@/lib/openproject-client";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const instanceUrl = String(body.instanceUrl ?? "").trim();
  const apiToken = String(body.apiToken ?? "").trim();

  if (!instanceUrl || !apiToken) {
    return NextResponse.json({ error: "Instance URL and API token are required" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ONE_YEAR,
  };

  res.cookies.set(INSTANCE_URL_COOKIE, instanceUrl, cookieOptions);
  res.cookies.set(API_TOKEN_COOKIE, apiToken, cookieOptions);
  res.cookies.set(USE_DUMMY_COOKIE, "0", { ...cookieOptions, httpOnly: false });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(INSTANCE_URL_COOKIE);
  res.cookies.delete(API_TOKEN_COOKIE);
  res.cookies.delete(USE_DUMMY_COOKIE);
  return res;
}
