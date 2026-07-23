"use client";

import { useMemo, useState } from "react";
import { useFilters } from "@/lib/filters-context";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
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
import type { WorkPackagePriority, WorkPackageStatus } from "@/lib/types";

const STATUSES: WorkPackageStatus[] = ["New", "In progress", "Closed", "On hold"];
const PRIORITIES: WorkPackagePriority[] = ["Low", "Normal", "High", "Immediate"];

export default function TicketsPage() {
  const { workPackages, loading, error } = useFilters();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");

  const filtered = useMemo(() => {
    return workPackages
      .filter((wp) => (status === "all" ? true : wp.status === status))
      .filter((wp) => (priority === "all" ? true : wp.priority === priority))
      .filter((wp) => wp.subject.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [workPackages, search, status, priority]);

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
            {STATUSES.map((s) => (
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
            {PRIORITIES.map((p) => (
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
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No tickets match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((wp) => (
                  <TableRow key={wp.id}>
                    <TableCell className="font-medium">{wp.subject}</TableCell>
                    <TableCell>
                      <StatusBadge status={wp.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={wp.priority} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{wp.project}</TableCell>
                    <TableCell className="text-muted-foreground">{wp.assignee}</TableCell>
                    <TableCell className="text-muted-foreground">{wp.percentDone}%</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(wp.updatedAt).toLocaleDateString()}
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
