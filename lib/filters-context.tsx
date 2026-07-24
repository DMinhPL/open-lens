"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { useApiQuery } from "@/lib/api/use-api-query";
import { matchesProject, wasCreatedInPeriod } from "@/lib/work-package-filters";
import type { OpenProjectProjectSummary, Period, WorkPackage } from "@/lib/types";

interface FiltersContextValue {
  allWorkPackages: WorkPackage[];
  workPackages: WorkPackage[];
  loading: boolean;
  error: string | null;
  projects: OpenProjectProjectSummary[];
  project: string;
  setProject: (project: string) => void;
  period: Period;
  setPeriod: (period: Period) => void;
  refresh: () => void;
}

export const DEFAULT_PROJECT_KEY = "openlens_default_project";

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const userProjects = useAppSelector((state) => state.user.projects);
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<{ workPackages: WorkPackage[] }>("/api/openproject/work-packages?mine=true");
  const allWorkPackages = useMemo(() => data?.workPackages ?? [], [data]);
  const [project, setProjectState] = useState("all");
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    // Reads browser-only storage post-mount; cannot be a lazy useState initializer because this runs during SSR.
    const defaultProject = window.localStorage.getItem(DEFAULT_PROJECT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (defaultProject) setProjectState(defaultProject);
  }, []);

  useEffect(() => {
    if (!userProjects || project === "all") return;
    if (userProjects.some((userProject) => String(userProject.id) === project)) return;

    const legacyProject = userProjects.find((userProject) => userProject.name === project);
    const migratedProject = legacyProject ? String(legacyProject.id) : "all";
    window.localStorage.setItem(DEFAULT_PROJECT_KEY, migratedProject);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- migrates legacy name-based project values to IDs
    setProjectState(migratedProject);
  }, [project, userProjects]);

  function setProject(value: string) {
    setProjectState(value);
  }

  const workPackages = useMemo(
    () =>
      allWorkPackages
        .filter((workPackage) => matchesProject(workPackage, project))
    ,
    [allWorkPackages, project, period],
  );

  const value: FiltersContextValue = {
    allWorkPackages,
    workPackages,
    loading,
    error,
    projects: userProjects ?? [],
    project,
    setProject,
    period,
    setPeriod,
    refresh,
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within a FiltersProvider");
  return ctx;
}
