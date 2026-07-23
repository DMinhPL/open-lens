"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Period, WorkPackage } from "@/lib/types";

interface FiltersContextValue {
  allWorkPackages: WorkPackage[];
  workPackages: WorkPackage[];
  loading: boolean;
  error: string | null;
  projects: string[];
  project: string;
  setProject: (project: string) => void;
  period: Period;
  setPeriod: (period: Period) => void;
  refresh: () => void;
}

export const DEFAULT_PROJECT_KEY = "openlens_default_project";

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [allWorkPackages, setAllWorkPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProjectState] = useState("all");
  const [period, setPeriod] = useState<Period>("month");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    // Reads browser-only storage post-mount; cannot be a lazy useState initializer because this runs during SSR.
    const defaultProject = window.localStorage.getItem(DEFAULT_PROJECT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (defaultProject) setProjectState(defaultProject);
  }, []);

  function setProject(value: string) {
    setProjectState(value);
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading whenever refreshToken changes
    setLoading(true);
    fetch("/api/openproject/work-packages")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setAllWorkPackages([]);
        } else {
          setError(null);
          setAllWorkPackages(data.workPackages ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const projects = useMemo(
    () => Array.from(new Set(allWorkPackages.map((wp) => wp.project))).sort(),
    [allWorkPackages],
  );

  const workPackages = useMemo(
    () => (project === "all" ? allWorkPackages : allWorkPackages.filter((wp) => wp.project === project)),
    [allWorkPackages, project],
  );

  const value: FiltersContextValue = {
    allWorkPackages,
    workPackages,
    loading,
    error,
    projects,
    project,
    setProject,
    period,
    setPeriod,
    refresh: () => setRefreshToken((t) => t + 1),
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within a FiltersProvider");
  return ctx;
}
