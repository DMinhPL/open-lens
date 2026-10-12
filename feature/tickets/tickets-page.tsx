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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useOpSettings } from "@/core/openproject/use-op-settings";
import { getWorkPackageUrl } from "@/core/openproject/openproject-links";
import {
  matchesProject,
  getReleaseDevUrgency,
  getReleaseDevRowClassName,
  getReleaseDevCellClassName,
  getReleaseDevUrgencyLabel,
} from "@/core/domain/work-package-filters";
import { isWithinDateRange } from "@/core/domain/date-range";
import { formatDateDDMMYYYY, cn } from "@/core/utils";
import { getTypeBadgeStyle } from "@/core/colors/type-colors";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

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
  const { allWorkPackages: workPackages, loading, error, project, dateRange } = useFilters();
  const { settings } = useOpSettings();
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>("all");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const statuses = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.statusLabel ?? wp.status))).sort(),
    [workPackages],
  );
  const priorities = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.priorityLabel ?? wp.priority))).sort(),
    [workPackages],
  );
  const types = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.type))).sort(),
    [workPackages],
  );

  const filtered = useMemo(() => {
    return workPackages
      .filter((wp) => matchesProject(wp, project))
      .filter((wp) => isWithinDateRange(wp.createdAt, dateRange))
      .filter((wp) =>
        selectedStatuses.length === 0
          ? true
          : selectedStatuses.includes(wp.statusLabel ?? wp.status),
      )
      .filter((wp) => (selectedTypes.length === 0 ? true : selectedTypes.includes(wp.type)))
      .filter((wp) => (priority === "all" ? true : (wp.priorityLabel ?? wp.priority) === priority))
      .filter((wp) => wp.subject.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [workPackages, project, dateRange, search, selectedStatuses, selectedTypes, priority]);

  // Any filter change (including project/date range from the top bar) sends the table back to
  // page 1. Tracked as a key next to the page instead of a reset effect, so there's no extra render.
  const filterKey = JSON.stringify([project, dateRange, search, selectedStatuses, selectedTypes, priority, pageSize]);
  const [pagination, setPagination] = useState({ filterKey, page: 1 });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = pagination.filterKey === filterKey ? Math.min(pagination.page, pageCount) : 1;
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  function goToPage(nextPage: number) {
    setPagination({ filterKey, page: Math.min(Math.max(nextPage, 1), pageCount) });
  }
  function toggleStatus(value: string, checked: boolean) {
    setSelectedStatuses((previous) =>
      checked ? [...previous, value] : previous.filter((status) => status !== value),
    );
  }

  function toggleType(value: string, checked: boolean) {
    setSelectedTypes((previous) =>
      checked ? [...previous, value] : previous.filter((type) => type !== value),
    );
  }

  function navigateToTicket(ticketId: number) {
    window.open(getWorkPackageUrl(settings?.instanceUrl, ticketId), "_blank", "noopener,noreferrer");
  }

  if (error) {
    return <p className="tickets-page__error text-sm text-destructive">Failed to load data: {error}</p>;
  }

  return (
    <div className="tickets-page flex flex-col gap-4">
      <div className="tickets-page__filters flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search tickets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="tickets-page__search max-w-xs"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="tickets-page__project-filter w-40 justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border-input bg-transparent py-2 pr-2 pl-2.5 text-sm font-normal"
              aria-label="Filter by status"
            >
              <span className="min-w-0 truncate">
                {selectedStatuses.length === 0
                  ? "All statuses"
                  : selectedStatuses.length === 1
                    ? selectedStatuses[0]
                    : `${selectedStatuses.length} statuses`}
              </span>
              <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {statuses.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={selectedStatuses.includes(s)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => toggleStatus(s, checked)}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="tickets-page__assignee-filter w-40 justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border-input bg-transparent py-2 pr-2 pl-2.5 text-sm font-normal"
              aria-label="Filter by type"
            >
              <span className="min-w-0 truncate">
                {selectedTypes.length === 0
                  ? "All types"
                  : selectedTypes.length === 1
                    ? selectedTypes[0]
                    : `${selectedTypes.length} types`}
              </span>
              <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {types.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedTypes.includes(type)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => toggleType(type, checked)}
              >
                {type}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger size="sm" className="tickets-page__type-filter w-40">
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
        <span className="tickets-page__count ml-auto text-sm text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} ticket${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="tickets-page__table rounded-lg border">
        {loading ? (
          <div className="tickets-page__loading space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="tickets-page__header-row">
                <TableHead className="tickets-page__header-cell w-16 text-right">Order</TableHead>
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
                <TableHead className="tickets-page__header-cell text-right">Logged time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="tickets-page__empty-row">
                  <TableCell colSpan={13} className="tickets-page__empty-state text-center text-muted-foreground">
                    No tickets assigned to you match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((wp, index) => {
                  const releaseDevUrgency = getReleaseDevUrgency(wp);

                  return (
                    <TableRow
                      key={wp.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ticket ${wp.subject} in OpenProject${getReleaseDevUrgencyLabel(releaseDevUrgency)}`}
                      className={cn(
                        "tickets-page__row",
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
                      <TableCell className="tickets-page__cell tickets-page__order-cell text-center text-muted-foreground">{pageStart + index + 1}</TableCell>
                      <TableCell className="tickets-page__cell tickets-page__subject-cell max-w-80 font-medium">
                        <span className="tickets-page__subject block truncate" title={wp.subject}>
                          {wp.subject}
                        </span>
                      </TableCell>
                      <TableCell className="tickets-page__cell tickets-page__type-cell">
                        <Badge variant="outline" className={getTypeBadgeStyle(wp.type)}>
                          <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
                          {wp.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="tickets-page__cell tickets-page__status-cell">
                        <StatusBadge status={wp.statusLabel ?? wp.status} />
                      </TableCell>
                      <TableCell className="tickets-page__cell text-muted-foreground">{wp.author}</TableCell>
                      <TableCell className="tickets-page__cell text-muted-foreground">{formatDateTime(wp.createdAt)}</TableCell>
                      <TableCell className="tickets-page__cell tickets-page__progress-cell">
                        <Badge variant="outline">{wp.priorityLabel ?? wp.priority}</Badge>
                      </TableCell>
                      <TableCell className="tickets-page__cell text-muted-foreground">{wp.project}</TableCell>
                      <TableCell className="tickets-page__cell tickets-page__progress-cell">
                        <div className="tickets-page__progress flex min-w-28 items-center gap-2">
                          <div className="tickets-page__progress-track h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="tickets-page__progress-bar h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, wp.percentDone))}%` }}
                            />
                          </div>
                          <span className="tickets-page__progress-value w-9 text-right text-muted-foreground">{wp.percentDone}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="tickets-page__cell text-muted-foreground">{formatDateDDMMYYYY(wp.startDate)}</TableCell>
                      <TableCell
                        className={cn("tickets-page__cell", "text-muted-foreground", getReleaseDevCellClassName(releaseDevUrgency))}
                      >
                        {formatDateDDMMYYYY(wp.customField25)}
                      </TableCell>
                      <TableCell className="tickets-page__cell text-muted-foreground">{formatDateDDMMYYYY(wp.dueDate)}</TableCell>
                      <TableCell className="tickets-page__cell text-right text-muted-foreground">
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

      {!loading && filtered.length > 0 ? (
        <div className="tickets-page__pagination flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="tickets-page__page-size flex items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger size="sm" className="tickets-page__page-size-trigger w-20" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="tickets-page__page-nav flex items-center gap-3">
            <span className="tickets-page__page-range">
              {pageStart + 1}–{pageStart + pageRows.length} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                className="tickets-page__page-prev"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="tickets-page__page-indicator min-w-20 text-center">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                className="tickets-page__page-next"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
