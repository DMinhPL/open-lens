"use client";

import { useFilters } from "@/lib/filters-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Period } from "@/lib/types";

export function Topbar() {
  const { projects, project, setProject, period, setPeriod, loading } = useFilters();

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <div className="text-sm text-muted-foreground">
        {loading ? "Loading work packages…" : "Personal work monitoring"}
      </div>
      <div className="flex items-center gap-3">
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="quarter">Quarterly</SelectItem>
          </SelectContent>
        </Select>

        <ThemeToggle />
      </div>
    </header>
  );
}
