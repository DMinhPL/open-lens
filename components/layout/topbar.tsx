"use client";

import { useFilters } from "@/core/filters-context";
import { useMode } from "@/core/mode-context";
import { useSidebar } from "@/core/sidebar-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { ProjectPicker } from "@/components/layout/project-picker";
import { Menu } from "lucide-react";

export function Topbar() {
  const { loading } = useFilters();
  const { mode } = useMode();
  const { toggle } = useSidebar();

  return (
    <header className="topbar glass sticky top-0 z-30 flex min-h-14 flex-col gap-2 border-b border-b-transparent px-4 py-2 md:z-50 md:h-14 md:flex-row md:items-center md:justify-between md:gap-4 md:py-0 md:px-6">
      <div className="topbar__mobile-row flex min-w-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle menu"
          className="topbar__menu-button rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="topbar__title min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {loading
            ? "Loading work packages…"
            : mode === "manager"
              ? "Project manager overview"
              : "Personal work monitoring"}
        </div>
        <div className="topbar__mobile-mode md:hidden">
          <ThemeToggle />
        </div>
      </div>
      <div className="topbar__controls flex min-w-0 items-center gap-2 md:gap-3">
        <div className="topbar__project-select shrink-0">
          <ModeToggle />
        </div>
        {/* Project Selector:  */}
        <ProjectPicker className="topbar__project-trigger min-w-0 flex-1 md:w-44 md:flex-none" />
        {/* Date Range Selector:  */}
        <DateRangePicker className="topbar__date-range-trigger min-w-0 flex-1 md:w-auto md:flex-none" />

        <div className="topbar__mode hidden md:block">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
