"use client";

import { useMemo, useState } from "react";
import { useFilters } from "@/lib/filters-context";
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
import { useOpSettings } from "@/lib/use-op-settings";
import { useApiQuery } from "@/lib/api/use-api-query";
import { getWorkPackageUrl } from "@/lib/openproject-links";
import { matchesProject, wasCreatedInPeriod } from "@/lib/work-package-filters";
import type { WorkPackage } from "@/lib/types";

const TYPE_BADGE_STYLES: Record<string, string> = {
  task: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  bug: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  "user story":
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  story:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  feature:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  epic: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  milestone:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  phase: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  risk: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

const TYPE_FALLBACK_STYLES = [
  "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
  "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300",
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "in progress":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "in specification":
    "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  resolved:
    "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
  closed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "on hold":
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  rejected:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  scheduled:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  confirmed:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
};

const STATUS_FALLBACK_STYLES = [
  "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300",
];

function getTypeBadgeStyle(type: string) {
  const normalized = type.trim().toLowerCase().replace(/[_-]+/g, " ");
  const knownStyle = TYPE_BADGE_STYLES[normalized];
  if (knownStyle) return knownStyle;

  const hash = Array.from(normalized).reduce((total, character) => total + character.charCodeAt(0), 0);
  return TYPE_FALLBACK_STYLES[hash % TYPE_FALLBACK_STYLES.length];
}

function getStatusBadgeStyle(status: string) {
  const normalized = status.trim().toLowerCase().replace(/[_-]+/g, " ");
  const knownStyle = STATUS_BADGE_STYLES[normalized];
  if (knownStyle) return knownStyle;

  const hash = Array.from(normalized).reduce((total, character) => total + character.charCodeAt(0), 0);
  return STATUS_FALLBACK_STYLES[hash % STATUS_FALLBACK_STYLES.length];
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}

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
  const { project, period } = useFilters();
  const { settings } = useOpSettings();
  const { data, loading, error } = useApiQuery<{ workPackages: WorkPackage[] }>(
    "/api/openproject/work-packages?mine=true",
  );
  const workPackages = useMemo(() => data?.workPackages ?? [], [data]);
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
      .filter((wp) => (status === "all" ? true : (wp.statusLabel ?? wp.status) === status))
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
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Logged time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    No tickets assigned to you match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((wp) => (
                  <TableRow
                    key={wp.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ticket ${wp.subject} in OpenProject`}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigateToTicket(wp.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToTicket(wp.id);
                      }
                    }}
                  >
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
                      <Badge
                        variant="outline"
                        className={getStatusBadgeStyle(wp.statusLabel ?? wp.status)}
                      >
                        <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
                        {wp.statusLabel ?? wp.status}
                      </Badge>
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
                    <TableCell className="text-muted-foreground">{formatDate(wp.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(wp.derivedDueDate)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatHours(wp.spentHours)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
