"use client";

import { useMemo } from "react";
import { useFilters } from "@/core/filters-context";
import { TicketFlow } from "@/feature/hierarchy/components/ticket-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch } from "lucide-react";
import { matchesProject, wasCreatedInPeriod } from "@/core/domain/work-package-filters";
import { getWorkPackageUrl } from "@/core/openproject/openproject-links";
import { useOpSettings } from "@/core/openproject/use-op-settings";

export default function HierarchyPage() {
  const { allWorkPackages, loading, error, project, period } = useFilters();
  const { settings } = useOpSettings();

  const filtered = useMemo(
    () =>
      allWorkPackages
        .filter((workPackage) => matchesProject(workPackage, project))
        .filter((workPackage) => wasCreatedInPeriod(workPackage.createdAt, period)),
    [allWorkPackages, project, period],
  );

  function navigateToTicket(ticketId: number) {
    window.open(getWorkPackageUrl(settings?.instanceUrl, ticketId), "_blank", "noopener,noreferrer");
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <GitBranch className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Ticket hierarchy</h2>
          {!loading && (
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {loading ? (
          <div className="p-4">
            <Skeleton className="h-[70vh] w-full" />
          </div>
        ) : (
          <TicketFlow workPackages={filtered} onSelect={navigateToTicket} />
        )}
      </div>
    </div>
  );
}
