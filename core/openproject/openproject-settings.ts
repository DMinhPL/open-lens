import { cookies } from "next/headers";

export const INSTANCE_URL_COOKIE = "op_instance_url";
export const API_TOKEN_COOKIE = "op_api_token";
export const USE_DUMMY_COOKIE = "op_use_dummy";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Shared cookie policy for the OpenProject connection cookies (instance URL, API token, dummy-data flag). */
export function buildOpCookieOptions(overrides: Partial<{ httpOnly: boolean }> = {}) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    ...overrides,
  };
}

export interface OpSettings {
  instanceUrl: string | null;
  apiToken: string | null;
  useDummyData: boolean;
}

/** Resolves the active OpenProject connection (instance URL, token, dummy-data switch) from cookies + env defaults. */
export async function getOpSettings(): Promise<OpSettings> {
  const store = await cookies();
  const instanceUrl = store.get(INSTANCE_URL_COOKIE)?.value ?? null;
  const apiToken = store.get(API_TOKEN_COOKIE)?.value ?? null;
  const dummyCookie = store.get(USE_DUMMY_COOKIE)?.value;

  const envDefault = process.env.USE_DUMMY_DATA !== "false";
  const useDummyData = dummyCookie ? dummyCookie === "1" : envDefault || !instanceUrl || !apiToken;

  return { instanceUrl, apiToken, useDummyData };
}
