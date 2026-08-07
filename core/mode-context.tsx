"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type AppMode = "member" | "manager";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const APP_MODE_KEY = "openlens_app_mode";

const ModeContext = createContext<ModeContextValue | null>(null);

/**
 * Tracks whether the app is showing the single-user "member" experience (Dashboard/Tickets/
 * Gantt/Workload, all scoped to the signed-in OpenProject account) or the "manager" experience
 * (Team Overview, aggregating every assignee's tasks/bugs for a selected project).
 *
 * Deliberately its own context rather than a `FiltersProvider` field: mode is pure UI-navigation
 * state, not server data, and keeping it separate lets the manager experience stay decoupled from
 * the single-user feature modules it sits alongside.
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("member");

  useEffect(() => {
    // Reads browser-only storage post-mount; cannot be a lazy useState initializer because this runs during SSR.
    const stored = window.localStorage.getItem(APP_MODE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "member" || stored === "manager") setModeState(stored);
  }, []);

  function setMode(next: AppMode) {
    setModeState(next);
    window.localStorage.setItem(APP_MODE_KEY, next);
  }

  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within a ModeProvider");
  return ctx;
}
