"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-managed Make.com credentials (webhook URL + API key) for the workflow-instructions
 * module. Unlike the OpenProject connection (httpOnly cookies, `core/openproject/openproject-settings.ts`),
 * these are end-user supplied per-browser and only ever read/sent from the client — kept in
 * `localStorage` rather than a server-side cookie.
 */
export const MAKE_WEBHOOK_URL_KEY = "openlens_make_webhook_url";
export const MAKE_API_KEY_KEY = "openlens_make_api_key";

export interface MakeCredentials {
  webhookUrl: string;
  apiKey: string;
}

/** Reads the saved Make.com credentials directly from `localStorage` (no React state). */
export function getMakeCredentials(): MakeCredentials {
  if (typeof window === "undefined") return { webhookUrl: "", apiKey: "" };
  return {
    webhookUrl: window.localStorage.getItem(MAKE_WEBHOOK_URL_KEY) ?? "",
    apiKey: window.localStorage.getItem(MAKE_API_KEY_KEY) ?? "",
  };
}

/** Removes any saved Make.com credentials from `localStorage`. */
export function clearMakeCredentials() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MAKE_WEBHOOK_URL_KEY);
  window.localStorage.removeItem(MAKE_API_KEY_KEY);
}

/**
 * Reactive wrapper around the `localStorage`-backed Make.com credentials, mirroring the
 * `useOpSettings` hook's role for the OpenProject connection.
 */
export function useMakeSettings() {
  const [credentials, setCredentials] = useState<MakeCredentials>({ webhookUrl: "", apiKey: "" });

  const refresh = useCallback(() => {
    const next = getMakeCredentials();
    setCredentials(next);
    return next;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial read of browser-only storage
    refresh();
  }, [refresh]);

  const save = useCallback((webhookUrl: string, apiKey: string) => {
    window.localStorage.setItem(MAKE_WEBHOOK_URL_KEY, webhookUrl);
    window.localStorage.setItem(MAKE_API_KEY_KEY, apiKey);
    setCredentials({ webhookUrl, apiKey });
  }, []);

  const clear = useCallback(() => {
    clearMakeCredentials();
    setCredentials({ webhookUrl: "", apiKey: "" });
  }, []);

  return {
    ...credentials,
    hasCredentials: Boolean(credentials.webhookUrl && credentials.apiKey),
    refresh,
    save,
    clear,
  };
}
