"use client";

import { useMemo, useState } from "react";
import { useFilters } from "@/core/filters-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useOpSettings } from "@/core/openproject/use-op-settings";
import { getWorkPackageUrl } from "@/core/openproject/openproject-links";
import {
  matchesProject,
  wasCreatedInPeriod,
  getReleaseDevUrgency,
  getReleaseDevRowClassName,
  getReleaseDevCellClassName,
  getReleaseDevUrgencyLabel,
} from "@/core/domain/work-package-filters";
import { formatDateDDMMYYYY, cn } from "@/core/utils";
import { getTypeBadgeStyle } from "@/core/colors/type-colors";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatHours(hours?: number) {
  if (hours === undefined) return "—";

  const roundedMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

export default function TicketsPage() {
  const { allWorkPackages: workPackages, loading, error, project, period } = useFilters();
  const { settings } = useOpSettings();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const statuses = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.statusLabel ?? wp.status))).sort(),
    [workPackages],
  );
  const priorities = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.priorityLabel ?? wp.priority))).sort(),
    [workPackages],
  );

  const filtered = useMemo(() => {
    return workPackages
      .filter((wp) => matchesProject(wp, project))
      .filter((wp) => wasCreatedInPeriod(wp.createdAt, period))
      .filter((wp) => (status === "all" ? true : wp.statusLabel === status))
      .filter((wp) => (priority === "all" ? true : (wp.priorityLabel ?? wp.priority) === priority))
      .filter((wp) => wp.subject.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [workPackages, project, period, search, status, priority]);

  function navigateToTicket(ticketId: number) {
    window.open(getWorkPackageUrl(settings?.instanceUrl, ticketId), "_blank", "noopener,noreferrer");
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search tickets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {priorities.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} ticket${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="rounded-lg border">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-right">Order</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>Release Dev</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Logged time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    No tickets assigned to you match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((wp, index) => {
                  const releaseDevUrgency = getReleaseDevUrgency(wp);

                  return (
                    <TableRow
                      key={wp.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ticket ${wp.subject} in OpenProject${getReleaseDevUrgencyLabel(releaseDevUrgency)}`}
                      className={cn(
                        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        getReleaseDevRowClassName(releaseDevUrgency),
                      )}
                      onClick={() => navigateToTicket(wp.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigateToTicket(wp.id);
                        }
                      }}
                    >
                      <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="max-w-80 font-medium">
                        <span className="block truncate" title={wp.subject}>
                          {wp.subject}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getTypeBadgeStyle(wp.type)}>
                          <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
                          {wp.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={wp.statusLabel ?? wp.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{wp.author}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(wp.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{wp.priorityLabel ?? wp.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{wp.project}</TableCell>
                      <TableCell>
                        <div className="flex min-w-28 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, wp.percentDone))}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-muted-foreground">{wp.percentDone}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateDDMMYYYY(wp.startDate)}</TableCell>
                      <TableCell
                        className={cn("text-muted-foreground", getReleaseDevCellClassName(releaseDevUrgency))}
                      >
                        {formatDateDDMMYYYY(wp.customField25)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateDDMMYYYY(wp.dueDate)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatHours(wp.spentHours)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
