"use client";

import { useFilters } from "@/core/filters-context";
import { useMode } from "@/core/mode-context";
import { useSidebar } from "@/core/sidebar-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { Menu } from "lucide-react";
import type { Period } from "@/core/domain/types";

export function Topbar() {
  const { projects, project, setProject, period, setPeriod, loading } = useFilters();
  const { mode } = useMode();
  const { toggle } = useSidebar();

  return (
    <header className="glass sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-b-transparent px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle menu"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="text-sm text-muted-foreground">
          {loading
            ? "Loading work packages…"
            : mode === "manager"
              ? "Project manager overview"
              : "Personal work monitoring"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ModeToggle />
        {/* Project Selector:  */}
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((projectOption) => (
              <SelectItem key={projectOption.id} value={String(projectOption.id)}>
                {projectOption.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Period Selector:  */}
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="quarter">This quarter</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>

        <ThemeToggle />
      </div>
    </header>
  );
}
