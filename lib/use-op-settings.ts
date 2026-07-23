"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpenProjectSettings } from "@/lib/types";

/**
 * Single point of contact for `GET /api/settings`. Any page that needs to know the
 * connection state (hasCredentials, instanceUrl, useDummyData) should use this
 * instead of duplicating the fetch.
 */
export function useOpSettings() {
  const [settings, setSettings] = useState<OpenProjectSettings | null>(null);

  const refresh = useCallback(async () => {
    const data: OpenProjectSettings = await fetch("/api/settings").then((res) => res.json());
    setSettings(data);
    return data;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount, mirrors React's documented data-fetching pattern
    refresh();
  }, [refresh]);

  return { settings, setSettings, refresh };
}
