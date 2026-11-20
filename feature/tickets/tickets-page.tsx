"use client";

import { Suspense, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOpSettings } from "@/core/openproject/use-op-settings";
import { apiFetch } from "@/core/api/http";
import { useAppSelector } from "@/core/store/hooks";
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

// useSearchParams requires a Suspense boundary for static rendering.
export default function TicketsPage() {
  return (
    <Suspense fallback={null}>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  const { allWorkPackages: workPackages, loading, error, project, dateRange, refresh } = useFilters();
  const { settings } = useOpSettings();
  const ticketStatuses = useAppSelector((state) => state.common.statuses) ?? [];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const progressInputRef = useRef<HTMLInputElement>(null);
  const loggedHoursInputRef = useRef<HTMLInputElement>(null);

  // Filter state lives in the URL query string (?q=&status=&type=&priority=&size=&page=),
  // so views are shareable/bookmarkable and survive reloads.
  const search = searchParams.get("q") ?? "";
  const selectedStatuses = searchParams.getAll("status");
  const selectedTypes = searchParams.getAll("type");
  const priority = searchParams.get("priority") ?? "all";
  const sizeParam = Number(searchParams.get("size"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const requestedPage = Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1);

  function updateQuery(update: (params: URLSearchParams) => void, { resetPage = true } = {}) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    if (resetPage) params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setSingle(params: URLSearchParams, key: string, value: string, defaultValue: string) {
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
  }

  function setMulti(params: URLSearchParams, key: string, values: string[]) {
    params.delete(key);
    values.forEach((value) => params.append(key, value));
  }

  const setSearch = (value: string) => updateQuery((p) => setSingle(p, "q", value, ""));

  const setPriority = (value: string) => updateQuery((p) => setSingle(p, "priority", value, "all"));

  const setPageSize = (value: number) =>
    updateQuery((p) => setSingle(p, "size", String(value), String(DEFAULT_PAGE_SIZE)));

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

  // Filter changes made here reset the page param; changing the top-bar project (also a URL
  // param, owned by FiltersProvider) or date range only clamps the page to the available range.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  function goToPage(nextPage: number) {
    const target = Math.min(Math.max(nextPage, 1), pageCount);
    updateQuery((p) => setSingle(p, "page", String(target), "1"), { resetPage: false });
  }

  function toggleStatus(value: string, checked: boolean) {
    const next = checked
      ? [...selectedStatuses, value]
      : selectedStatuses.filter((status) => status !== value);
    updateQuery((p) => setMulti(p, "status", next));
  }

  function toggleType(value: string, checked: boolean) {
    const next = checked ? [...selectedTypes, value] : selectedTypes.filter((type) => type !== value);
    updateQuery((p) => setMulti(p, "type", next));
  }

  const selectedTicket = workPackages.find((workPackage) => workPackage.id === selectedTicketId) ?? null;

  function openTicket(ticket: (typeof workPackages)[number]) {
    setSelectedTicketId(ticket.id);
    setStatusId(String(ticketStatuses.find((status) => status.name === (ticket.statusLabel ?? ticket.status))?.id ?? ""));
    setStartDate(ticket.startDate ?? "");
    setDueDate(ticket.dueDate ?? "");
    setSaveError(null);
  }

  function handleTicketRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, ticket: (typeof workPackages)[number]) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openTicket(ticket);
  }

  async function saveTicket() {
    if (!selectedTicket) return;

    const progressValue = Number(progressInputRef.current?.value);
    if (!Number.isInteger(progressValue) || progressValue < 0 || progressValue > 100) {
      setSaveError("Progress must be a whole number from 0 to 100.");
      return;
    }

    const loggedHoursValue = loggedHoursInputRef.current?.value.trim() ?? "";
    const enteredHours = loggedHoursValue === "" ? undefined : Number(loggedHoursValue);
    if (enteredHours !== undefined && (!Number.isFinite(enteredHours) || enteredHours <= 0)) {
      setSaveError("Logged hours must be a positive number.");
      return;
    }

    const currentStatusId = ticketStatuses.find(
      (status) => status.name === (selectedTicket.statusLabel ?? selectedTicket.status),
    )?.id;
    const nextStatusId = Number(statusId);
    const updates: {
      percentageDone?: number;
      statusId?: number;
      loggedHours?: number;
      startDate?: string;
      dueDate?: string;
    } = {};
    if (progressValue !== selectedTicket.percentDone) updates.percentageDone = progressValue;
    if (Number.isSafeInteger(nextStatusId) && nextStatusId > 0 && nextStatusId !== currentStatusId) {
      updates.statusId = nextStatusId;
    }
    if (enteredHours !== undefined) updates.loggedHours = enteredHours;
    if (startDate !== (selectedTicket.startDate ?? "")) updates.startDate = startDate;
    if (dueDate !== (selectedTicket.dueDate ?? "")) updates.dueDate = dueDate;

    if (Object.keys(updates).length === 0) {
      setSelectedTicketId(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await apiFetch<{ ok: boolean; errors?: Record<string, string> }>(`/api/openproject/work-packages/${selectedTicket.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await refresh();
      const errors = Object.values(result.errors ?? {});
      if (errors.length === 0) setSelectedTicketId(null);
      else setSaveError(errors.join(" "));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save ticket changes.");
    } finally {
      setSaving(false);
    }
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
                      aria-label={`View ticket ${wp.subject}${getReleaseDevUrgencyLabel(releaseDevUrgency)}`}
                      className={cn(
                        "tickets-page__row",
                        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        getReleaseDevRowClassName(releaseDevUrgency),
                      )}
                      onClick={() => openTicket(wp)}
                      onKeyDown={(event) => handleTicketRowKeyDown(event, wp)}
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

      <Dialog open={selectedTicket !== null} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <DialogContent className="tickets-page__ticket-dialog max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
          {selectedTicket && (
            <>
              <DialogHeader className="tickets-page__ticket-dialog-header pr-8">
                <DialogTitle className="tickets-page__ticket-dialog-title">{selectedTicket.subject}</DialogTitle>
                <DialogDescription>
                  #{selectedTicket.id} · {selectedTicket.type} · {selectedTicket.statusLabel ?? selectedTicket.status}
                </DialogDescription>
              </DialogHeader>

              <dl className="tickets-page__ticket-details grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Project</dt>
                  <dd>{selectedTicket.project}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Select
                      value={
                        statusId ||
                        String(ticketStatuses.find((status) => status.name === (selectedTicket.statusLabel ?? selectedTicket.status))?.id ?? "")
                      }
                      onValueChange={setStatusId}
                    >
                      <SelectTrigger size="sm" aria-label="Ticket status">
                        <SelectValue placeholder={selectedTicket.statusLabel ?? selectedTicket.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {ticketStatuses.map((status) => (
                          <SelectItem key={status.id} value={String(status.id)}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Assignee</dt>
                  <dd>{selectedTicket.assignee || "Unassigned"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created by</dt>
                  <dd>{selectedTicket.author}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created at</dt>
                  <dd>{formatDateTime(selectedTicket.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd>{formatDateTime(selectedTicket.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Progress (%)</dt>
                  <dd>
                    <Input
                      aria-label="Ticket progress percent"
                      className="h-8"
                      defaultValue={selectedTicket.percentDone}
                      max={100}
                      min={0}
                      ref={progressInputRef}
                      type="number"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Log time (hours)</dt>
                  <dd>
                    <Input
                      aria-label="Hours to log"
                      className="h-8"
                      defaultValue=""
                      min={0}
                      placeholder={`Current total: ${formatHours(selectedTicket.spentHours)}`}
                      ref={loggedHoursInputRef}
                      step="0.25"
                      type="number"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Start date</dt>
                  <dd>
                    <Input
                      aria-label="Ticket start date"
                      className="h-8"
                      onChange={(event) => setStartDate(event.target.value)}
                      type="date"
                      value={startDate}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due date</dt>
                  <dd>
                    <Input
                      aria-label="Ticket due date"
                      className="h-8"
                      onChange={(event) => setDueDate(event.target.value)}
                      type="date"
                      value={dueDate}
                    />
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-muted-foreground">Logging time adds hours to the ticket&apos;s current total.</p>
              {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

              <div className="flex flex-wrap gap-2">
                <Button disabled={saving} onClick={saveTicket}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button asChild className="tickets-page__ticket-open-link" variant="outline">
                  <a href={getWorkPackageUrl(settings?.instanceUrl, selectedTicket.id)} target="_blank" rel="noopener noreferrer">
                    Open in OpenProject
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
