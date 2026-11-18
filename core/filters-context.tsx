"use client";

import { useGetMyWorkPackagesQuery } from "@/core/api/api-slice";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDefaultDateRange } from "@/core/domain/date-range";
import type { DateRange, OpenProjectProjectSummary, WorkPackage } from "@/core/domain/types";
import { matchesProject } from "@/core/domain/work-package-filters";
import { useAppSelector } from "@/core/store/hooks";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface FiltersContextValue {
  allWorkPackages: WorkPackage[];
  workPackages: WorkPackage[];
  loading: boolean;
  error: string | null;
  projects: OpenProjectProjectSummary[];
  project: string;
  setProject: (project: string) => void;
  dateRange: DateRange;
  setDateRange: (dateRange: DateRange) => void;
  refresh: () => void;
}

export const DEFAULT_PROJECT_KEY = "openlens_default_project";

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const userProjects = useAppSelector((state) => state.user.projects);
  const {
    data,
    isFetching: loading,
    error: queryError,
    refetch: refresh,
  } = useGetMyWorkPackagesQuery(undefined, { skip: pathname.startsWith("/pm") });
  const error = queryError ? (queryError as { message?: string }).message ?? "Request failed" : null;
  const allWorkPackages = useMemo(() => data?.workPackages ?? [], [data]);
  const router = useRouter();
  const searchParams = useSearchParams();
  // The selected project lives in the URL (?project=<id|all>) so views are shareable. The state
  // below is only the fallback when the URL has none (stored default, or the last pick after
  // navigating to a page whose URL dropped the param).
  const urlProject = searchParams.get("project");
  const [fallbackProject, setFallbackProject] = useState("all");
  const project = urlProject ?? fallbackProject;
  const [dateRange, setDateRange] = useState<DateRange>(() => getDefaultDateRange());

  const replaceProjectParam = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("project", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setProject = useCallback(
    (value: string) => {
      setFallbackProject(value);
      replaceProjectParam(value);
    },
    [replaceProjectParam],
  );

  useEffect(() => {
    // Reads browser-only storage post-mount; cannot be a lazy useState initializer because this runs during SSR.
    const defaultProject = window.localStorage.getItem(DEFAULT_PROJECT_KEY);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage post-mount
    if (defaultProject) setFallbackProject(defaultProject);
  }, []);

  useEffect(() => {
    // Keep the URL in sync after navigating to a page that dropped the param.
    if (urlProject === null && fallbackProject !== "all") replaceProjectParam(fallbackProject);
  }, [urlProject, fallbackProject, replaceProjectParam]);

  useEffect(() => {
    if (!userProjects || project === "all") return;
    if (userProjects.some((userProject) => String(userProject.id) === project)) return;

    const legacyProject = userProjects.find((userProject) => userProject.name === project);
    const migratedProject = legacyProject ? String(legacyProject.id) : "all";
    window.localStorage.setItem(DEFAULT_PROJECT_KEY, migratedProject);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- migrates legacy name-based project values to IDs
    setProject(migratedProject);
  }, [project, userProjects, setProject]);

  const workPackages = useMemo(
    () =>
      allWorkPackages
        .filter((workPackage) => matchesProject(workPackage, project))
    ,
    [allWorkPackages, project],
  );

  const value: FiltersContextValue = {
    allWorkPackages,
    workPackages,
    loading,
    error,
    projects: userProjects ?? [],
    project,
    setProject,
    dateRange,
    setDateRange,
    refresh,
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within a FiltersProvider");
  return ctx;
}
